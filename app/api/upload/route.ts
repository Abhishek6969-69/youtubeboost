import { NextRequest, NextResponse } from "next/server";
import formidable from "formidable";
import { promises as fs } from "fs";
import path from "path";
import { uploadVideo } from "@/lib/Youtube";
import { getServerSession } from "next-auth";
// import { authOptions } from "../auth/[...nextauth]/route";
import {authOptions} from "@/lib/auth"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.id) {
    return NextResponse.json({ authUrl: "/api/auth/signin" }, { status: 401 });
  }

  const form = formidable({
    uploadDir: path.join(__dirname, "../../../../../Uploads"),
    keepExtensions: true,
  });

  try {
    const { fields, files } = await new Promise<{
      fields: formidable.Fields;
      files: formidable.Files;
    }>((resolve, reject) => {
      form.parse(req as unknown as import("http").IncomingMessage, (err, fields, files) => {
        if (err) reject(err);
        resolve({ fields, files });
      });
    });

    const videoFile = files.video?.[0];
    const title = fields.title?.[0];
    const description = fields.description?.[0];
    const thumbnail = fields.thumbnail?.[0];
    const hashtags = fields.hashtags ? JSON.parse(fields.hashtags[0]) : [];

    if (!videoFile || !title || !description || !thumbnail) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    try {
      const videoId = await uploadVideo(
        videoFile.filepath,
        thumbnail,
        title,
        description,
        hashtags,
        session.user.id
      );
      await fs.unlink(videoFile.filepath);
      await fs.unlink(thumbnail);
      return NextResponse.json({ videoId, message: "Video uploaded successfully" });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "No tokens found for user") {
        const authUrl = `/api/auth/signin?callbackUrl=${encodeURIComponent("/api/upload")}`;
        return NextResponse.json({ authUrl }, { status: 200 });
      }
      throw error;
    }
  } catch (error) {
    console.error("Error uploading video:", error);
    return NextResponse.json({ error: "Failed to upload video" }, { status: 500 });
  }
}