import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateThumbnail } from "@/lib/thumbnail";
import { generateMetadata } from "@/lib/openai";
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
console.log(session)
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
    } catch (thumbError) {
      console.error("Thumbnail generation error:", thumbError);
      throw new Error("Failed to generate thumbnail");
    }

    const metadataContext = context || videoFile.name;
    type Metadata = {
      title: string;
      description: string;
      hashtags: string[];
      category?: string;
    };
    const metadata = await generateMetadata(metadataContext) as Metadata;
    // Ensure metadata has a category property
    if (!('category' in metadata)) {
      metadata.category = "Uncategorized"; // or set a default/fallback value
    }

    let videoRecord;
    try {
      videoRecord = await prisma.video.create({
        data: {
          userId: session.user.id,
          filePath: videoPath,
          title: metadata.title,
          description: metadata.description,
          thumbnail: thumbnailPath,
          category:metadata.category, // Removed because 'category' is not a valid field in the Video model
          hashtags: metadata.hashtags,
          status: "PENDING", // Standardized to uppercase
        },
      });
    } catch (dbError) {
      console.error("Database error:", dbError);
      return NextResponse.json({ error: "Failed to save video metadata to database" }, { status: 500 });
    }

    return NextResponse.json({
      title: metadata.title,
      description: metadata.description,
      thumbnail: path.basename(thumbnailPath),
      videoPath: path.basename(videoPath),
      hashtags: metadata.hashtags,
      category:metadata.category,
    });
  } catch (error: any) {
    console.error("Error processing video:", error);
    return NextResponse.json({ error: `Failed to process video: ${error.message}` }, { status: 500 });
  }
}