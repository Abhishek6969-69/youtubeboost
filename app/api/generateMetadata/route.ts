import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { google } from "googleapis";
import { generateThumbnail } from "@/lib/thumbnail";
import { generateMetadata } from "@/lib/openai";
import prisma from "@/lib/prisma";
import { writeFile, unlink, mkdir, access } from "fs/promises";
import { createReadStream } from "fs";
import path from "path";
import { tmpdir } from "os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Authenticate user
  const session = await getServerSession(authOptions);
  if (!session || !session.user.id || !session.user.accessToken) {
    return NextResponse.json({ authUrl: "/api/auth/signin" }, { status: 401 });
  }

  let videoPath: string | null = null;
  let thumbnailPath: string | null = null;

  try {
    // Parse form data
    const formData = await req.formData();
    const videoFile = formData.get("video") as File | null;
    const context = formData.get("context") as string | null;

    if (!videoFile) {
      return NextResponse.json({ error: "No video file uploaded" }, { status: 400 });
    }

    // Validate file size (max 100 MB)
    if (videoFile.size > 100 * 1024 * 1024) {
      return NextResponse.json({ error: "File size exceeds 100 MB" }, { status: 400 });
    }

    // Save file to temporary directory
    const fileName = `${Date.now()}-${videoFile.name}`;
    const uploadDir = path.join(tmpdir(), "uploads");
    videoPath = path.join(uploadDir, fileName);

    await mkdir(uploadDir, { recursive: true });
    const fileBuffer = Buffer.from(await videoFile.arrayBuffer());
    await writeFile(videoPath, fileBuffer);

    // Generate thumbnail and metadata
    try {
      thumbnailPath = await generateThumbnail(videoPath);
    } catch (thumbError) {
      console.error("Thumbnail generation error:", thumbError);
      throw new Error("Failed to generate thumbnail");
    }

    const metadataContext = context || videoFile.name;
    const metadata = await generateMetadata(metadataContext);

    // Store video metadata in Prisma
    let videoRecord;
    try {
      videoRecord = await prisma.video.create({
        data: {
          userId: session.user.id,
          filePath: videoPath,
          title: metadata.title,
          description: metadata.description,
          thumbnail: thumbnailPath,
          hashtags: metadata.hashtags,
          status: "pending",
        },
      });
    } catch (dbError) {
      console.error("Database error:", dbError);
      return NextResponse.json({ error: "Failed to save video metadata to database" }, { status: 500 });
    }

    // Upload to YouTube
    const youtube = google.youtube({
      version: "v3",
      auth: session.user.accessToken,
    });

    try {
      const youtubeResponse = await youtube.videos.insert({
        part: ["snippet", "status"],
        requestBody: {
          snippet: {
            title: metadata.title,
            description: metadata.description,
            tags: metadata.hashtags,
          },
          status: {
            privacyStatus: "private",
          },
        },
        media: {
          body: createReadStream(videoPath),
        },
      });

      // Update Prisma with YouTube video ID
      await prisma.video.update({
        where: { id: videoRecord.id },
        data: {
          youtubeVideoId: youtubeResponse.data.id,
          status: "uploaded",
        },
      });

      return NextResponse.json({
        title: metadata.title,
        description: metadata.description,
        thumbnail: thumbnailPath,
        videoPath,
        hashtags: metadata.hashtags,
        youtubeVideoId: youtubeResponse.data.id,
      });
    } catch (youtubeError: any) {
      console.error("YouTube upload error:", youtubeError);
      if (youtubeError.code === 401) {
        return NextResponse.json({ error: "Invalid or expired access token" }, { status: 401 });
      }
      return NextResponse.json({ error: "Failed to upload video to YouTube" }, { status: 500 });
    }
  } catch (error: any) {
    console.error("Error processing video:", error);
    return NextResponse.json({ error: `Failed to process video: ${error.message}` }, { status: 500 });
  } finally {
    // Clean up temporary files
    if (videoPath) {
      try {
        await access(videoPath);
        await unlink(videoPath);
      } catch (err) {
        console.warn("Failed to delete video file:", err);
      }
    }
    if (thumbnailPath) {
      try {
        await access(thumbnailPath);
        await unlink(thumbnailPath);
      } catch (err) {
        console.warn("Failed to delete thumbnail file:", err);
      }
    }
  }
}