import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateThumbnail } from "@/lib/thumbnail";
import { generateMetadata } from "@/lib/openai";
import { initPineconeIndex } from "@/lib/pinecone";
import { generateEmbedding } from "@/lib/embedding";
import prisma from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { tmpdir } from "os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.id || !session.user.accessToken) {
    return NextResponse.json({ authUrl: "/api/auth/signin" }, { status: 401 });
  }

  let videoPath: string | null = null;
  let thumbnailPath: string | null = null;

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

    const fileName = `${Date.now()}-${videoFile.name}`;
    const uploadDir = path.join(tmpdir(), "uploads");
    videoPath = path.join(uploadDir, fileName);

    await mkdir(uploadDir, { recursive: true });
    const fileBuffer = Buffer.from(await videoFile.arrayBuffer());
    await writeFile(videoPath, fileBuffer);

    try {
      thumbnailPath = await generateThumbnail(videoPath);
      console.log('Generated thumbnailPath:', thumbnailPath);
    } catch (thumbError) {
      console.error("Thumbnail generation error:", thumbError);
      throw new Error("Failed to generate thumbnail");
    }

    const metadataContext = context || videoFile.name;
    const metadata = await generateMetadata(metadataContext);

    const index = await initPineconeIndex();
    const embedding = await generateEmbedding(`${metadata.title} ${metadata.description} ${metadata.hashtags.join(" ")}`);
    await index.upsert([
      {
        id: videoFile.name,
        values: embedding,
        metadata: {
          title: metadata.title,
          description: metadata.description,
          hashtags: metadata.hashtags,
          category: metadata.category || "Uncategorized",
        },
      },
    ]);

    let videoRecord;
    try {
      videoRecord = await prisma.video.create({
        data: {
          userId: session.user.id,
          filePath: videoPath,
          title: metadata.title,
          description: metadata.description,
          thumbnail: thumbnailPath,
          category: metadata.category || "Uncategorized",
          hashtags: metadata.hashtags,
          status: "PENDING",
        },
      });
    } catch (dbError) {
      console.error("Database error:", dbError);
      return NextResponse.json({ error: "Failed to save video metadata to database" }, { status: 500 });
    }

    if (!thumbnailPath) {
      throw new Error('Thumbnail path is undefined');
    }

    return NextResponse.json({
      title: metadata.title,
      description: metadata.description,
      thumbnail: path.basename(thumbnailPath),
      videoPath: path.basename(videoPath),
      hashtags: metadata.hashtags,
      category: metadata.category,
    });
  } catch (error: any) {
    console.error("Error processing video:", error);
    return NextResponse.json({ error: `Failed to process video: ${error.message}` }, { status: 500 });
  }
}