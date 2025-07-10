import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateThumbnail } from "@/lib/thumbnail";
import { generateMetadata } from "@/lib/openai";
import { initPineconeIndex } from "@/lib/pinecone";
import { generateEmbedding } from "@/lib/embedding";
import prisma from "@/lib/prisma";

// Extend the Session type to include user id
declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      accessToken?: string;
      refreshToken?: string;
      expiryDate?: number | null;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60 seconds for video processing

export async function POST(req: NextRequest) {
  console.log("🚀 GenerateMetadata API called");
  
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.id) {
    return NextResponse.json({ authUrl: "/api/auth/signin" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const videoFile = formData.get("video") as File | null;
    const context = formData.get("context") as string | null;

    if (!videoFile) {
      return NextResponse.json({ error: "No video file uploaded" }, { status: 400 });
    }

    if (videoFile.size > 100 * 1024 * 1024) {
      return NextResponse.json({ error: "File size exceeds 100 MB" }, { status: 400 });
    }

    console.log("📹 Processing video:", videoFile.name, "Size:", videoFile.size);

    // Generate metadata using AI
    const metadataContext = context || videoFile.name;
    console.log("🤖 Generating metadata with context:", metadataContext);
    
    const metadata = await generateMetadata(metadataContext);
    console.log("✅ Metadata generated:", metadata);

    // Generate thumbnail using Cloudinary
    let thumbnailUrl = '';
    try {
      console.log("🎬 Starting thumbnail generation...");
      thumbnailUrl = await generateThumbnail(videoFile);
      console.log("✅ Thumbnail generated successfully:", thumbnailUrl);
    } catch (thumbError) {
      console.error("❌ Thumbnail generation failed:", thumbError);
      // Continue without thumbnail - it's not critical for metadata generation
    }

    // Store in Pinecone for future reference
    try {
      const index = await initPineconeIndex();
      const embedding = await generateEmbedding(
        `${metadata.title} ${metadata.description} ${metadata.hashtags.join(" ")}`
      );
      
      await index.upsert([
        {
          id: `${Date.now()}-${videoFile.name}`,
          values: embedding,
          metadata: {
            title: metadata.title,
            description: metadata.description,
            hashtags: metadata.hashtags,
            category: metadata.category || "Uncategorized",
            userId: session.user.id,
          },
        },
      ]);
      console.log("✅ Metadata stored in Pinecone");
    } catch (pineconeError) {
      console.warn("⚠️ Pinecone indexing failed:", pineconeError);
      // Continue without failing the request
    }

    // Store in database
    let videoRecord;
    try {
      videoRecord = await prisma.video.create({
        data: {
          userId: session.user.id,
          filePath: videoFile.name, // Store original filename
          title: metadata.title,
          description: metadata.description,
          thumbnail: thumbnailUrl || null,
          category: metadata.category || "Uncategorized",
          hashtags: metadata.hashtags,
          status: "PENDING",
        },
      });
      console.log("✅ Video record created in database:", videoRecord.id);
    } catch (dbError) {
      console.error("❌ Database error:", dbError);
      return NextResponse.json({ 
        error: "Failed to save video metadata to database" 
      }, { status: 500 });
    }

    return NextResponse.json({
      title: metadata.title,
      description: metadata.description,
      hashtags: metadata.hashtags,
      category: metadata.category,
      thumbnail: thumbnailUrl,
      videoId: videoRecord.id,
      message: "Metadata generated successfully!",
    });
  } catch (error: any) {
    console.error("❌ Error processing video:", error);
    return NextResponse.json({ 
      error: `Failed to process video: ${error.message}` 
    }, { status: 500 });
  }
}