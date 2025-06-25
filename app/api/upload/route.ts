import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { uploadVideo } from "@/lib/Youtube";
import prisma from "@/lib/prisma";
import { tmpdir } from "os";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const uploadDir = path.join(tmpdir(), "uploads");

async function ensureUploadDirectory() {
  try {
    await fs.mkdir(uploadDir, { recursive: true });
    console.log("Upload directory ensured:", uploadDir);
  } catch (err) {
    console.error("Failed to create upload dir:", err);
  }
}

ensureUploadDirectory();

// Input validation schema
const uploadSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(5000),
  hashtags: z.array(z.string().max(50)).max(10),
});

function isFileLike(obj: any): obj is { name: string; type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> } {
  return (
    obj != null &&
    typeof obj === "object" &&
    typeof obj.name === "string" &&
    typeof obj.type === "string" &&
    typeof obj.size === "number" &&
    typeof obj.arrayBuffer === "function"
  );
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.id) {
    console.warn("Unauthorized access attempt: No session or user ID.");
    return NextResponse.json({ authUrl: "/api/auth/signin" }, { status: 401 });
  }

  if (!session.user.accessToken) {
    console.error("No access token found for user:", session.user.id);
    const callbackUrl = encodeURIComponent("/upload");
    return NextResponse.json(
      { authUrl: `/api/auth/signin?callbackUrl=${callbackUrl}` },
      { status: 401 }
    );
  }

  let videoPath: string | undefined;
  let thumbnailPath: string | undefined;
  let videoRecordId: number | undefined;

  console.time("uploadProcessing");

  try {
    console.time("ParseFormData");
    const formData = await req.formData();
    const video = formData.get("video");
    const title = formData.get("title") as string | null;
    const description = formData.get("description") as string | null;
    const thumbnail = formData.get("thumbnail");
    const hashtagsRaw = formData.get("hashtags") as string | null;
    const hashtags = hashtagsRaw ? JSON.parse(hashtagsRaw) : [];
    console.timeEnd("ParseFormData");

    // Validate inputs
    try {
      uploadSchema.parse({ title, description, hashtags });
    } catch (validationError) {
      console.error("Input validation error:", validationError);
      return NextResponse.json({ error: "Invalid input data" }, { status: 400 });
    }

    if (!video || !title || !description || !thumbnail) {
      console.error("Missing required fields:", {
        video: !!video,
        title: !!title,
        description: !!description,
        thumbnail: !!thumbnail,
      });
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!isFileLike(video)) {
      console.error("Invalid video file: Object is not File-like.");
      return NextResponse.json({ error: "Invalid video file" }, { status: 400 });
    }

    // Validate file sizes
    const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
    const MAX_THUMBNAIL_SIZE = 5 * 1024 * 1024; // 5MB
    if (video.size > MAX_VIDEO_SIZE) {
      console.error(`Video file too large: ${video.size} bytes.`);
      return NextResponse.json({ error: `Video file too large. Maximum size is ${MAX_VIDEO_SIZE / (1024 * 1024)}MB.` }, { status: 400 });
    }

    // Handle thumbnail (File or basename)
    if (typeof thumbnail === "string") {
      thumbnailPath = path.join(uploadDir, thumbnail);
      try {
        await fs.access(thumbnailPath);
      } catch (err) {
        console.error("Thumbnail file not found:", thumbnailPath);
        return NextResponse.json({ error: "Thumbnail file not found" }, { status: 400 });
      }
    } else if (!isFileLike(thumbnail)) {
      console.error("Invalid thumbnail file: Object is not File-like.");
      return NextResponse.json({ error: "Invalid thumbnail file" }, { status: 400 });
    } else {
      if (thumbnail.size > MAX_THUMBNAIL_SIZE) {
        console.error(`Thumbnail file too large: ${thumbnail.size} bytes.`);
        return NextResponse.json({ error: `Thumbnail file too large. Maximum size is ${MAX_THUMBNAIL_SIZE / (1024 * 1024)}MB.` }, { status: 400 });
      }
      thumbnailPath = path.join(uploadDir, `${Date.now()}-${thumbnail.name}`);
      const thumbnailBuffer = Buffer.from(await thumbnail.arrayBuffer());
      await fs.writeFile(thumbnailPath, thumbnailBuffer);
    }

    console.time("SaveFiles");
    videoPath = path.join(uploadDir, `${Date.now()}-${video.name}`);
    const videoBuffer = Buffer.from(await video.arrayBuffer());
    await fs.writeFile(videoPath, videoBuffer);
    console.log("Temporary files saved:", videoPath, thumbnailPath);
    console.timeEnd("SaveFiles");

    console.time("SaveToDatabase");
    try {
      const videoRecord = await prisma.video.create({
        data: {
          userId: session.user.id,
          filePath: videoPath,
          title,
          description,
          thumbnail: thumbnailPath,
          hashtags,
          status: "PENDING",
        },
      });
      videoRecordId = videoRecord.id;
      console.log("Video record created in database with ID:", videoRecordId);
    } catch (dbError) {
      console.error("Error saving video metadata to database:", dbError);
      await cleanupFiles(videoPath, thumbnailPath);
      return NextResponse.json({ error: "Failed to save video information." }, { status: 500 });
    }
    console.timeEnd("SaveToDatabase");

    console.time("UploadVideo");
    let youtubeVideoId: string;
    try {
      const uploadResult = await uploadVideo(
        videoPath,
        thumbnailPath,
        title,
        description,
        hashtags,
        session.user.id as string,
        session.user.accessToken as string
      );

      if (typeof uploadResult === "string") {
        youtubeVideoId = uploadResult;
        console.log("Video uploaded to YouTube successfully. Video ID:", youtubeVideoId);
      } else {
        console.error("uploadVideo did not return a valid video ID:", uploadResult);
        throw new Error("YouTube upload failed: Invalid response from upload function.");
      }
    } catch (uploadError) {
      console.error("Error uploading video to YouTube:", uploadError);
      if (videoRecordId) {
        try {
          await prisma.video.update({
            where: { id: videoRecordId },
            data: { status: "UPLOAD_FAILED" },
          });
          console.log("Video record status updated to UPLOAD_FAILED.");
        } catch (updateError) {
          console.error("Failed to update video record status after upload failure:", updateError);
        }
      }
      if (uploadError instanceof Error && uploadError.message.includes("Authentication")) {
        const authUrl = `/api/auth/signin?callbackUrl=${encodeURIComponent("/upload")}`;
        return NextResponse.json({ error: "Authentication failed during YouTube upload. Please sign in again.", authUrl }, { status: 401 });
      }
      return NextResponse.json({ error: "Failed to upload video to YouTube." }, { status: 500 });
    }

    if (videoRecordId) {
      try {
        await prisma.video.update({
          where: { id: videoRecordId },
          data: { youtubeVideoId: youtubeVideoId, status: "UPLOADED" },
        });
        console.log("Video record status updated to UPLOADED with YouTube ID:", youtubeVideoId);
      } catch (updateError) {
        console.error("Failed to update video record with YouTube ID:", updateError);
      }
    }

    console.timeEnd("UploadVideo");
    return NextResponse.json({ videoId: youtubeVideoId, message: "Video uploaded successfully" });

  } catch (error: unknown) {
    console.error("An unexpected error occurred during video upload:", error);
    await cleanupFiles(videoPath, thumbnailPath);
    if (error instanceof Error && error.message === "No tokens found for user") {
      const authUrl = `/api/auth/signin?callbackUrl=${encodeURIComponent("/upload")}`;
      return NextResponse.json({ error: "Authentication required.", authUrl }, { status: 401 });
    }
    return NextResponse.json({ error: "An internal server error occurred during the upload process." }, { status: 500 });
  } finally {
    console.timeEnd("uploadProcessing");
    await cleanupFiles(videoPath, thumbnailPath);
  }
}

async function cleanupFiles(videoPath?: string, thumbnailPath?: string) {
  if (videoPath) {
    try {
      await fs.unlink(videoPath);
      console.log("Deleted temporary video file:", videoPath);
    } catch (err) {
      if ((err as any).code !== "ENOENT") {
        console.warn("Failed to delete temporary video file:", err);
      }
    }
  }
  if (thumbnailPath) {
    try {
      await fs.unlink(thumbnailPath);
      console.log("Deleted temporary thumbnail file:", thumbnailPath);
    } catch (err) {
      if ((err as any).code !== "ENOENT") {
        console.warn("Failed to delete temporary thumbnail file:", err);
      }
    }
  }
}