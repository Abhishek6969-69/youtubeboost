import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { writeFile, unlink } from "fs/promises";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { google } from "googleapis";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export async function POST(req: NextRequest) {
  console.log("🛠️ Upload route hit");

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user?.googleAccessToken  && !user?.googleRefreshToken) {
      return NextResponse.json({ error: "Missing Google tokens" }, { status: 403 });
    }

    const formData = await req.formData();
    const videoFile = formData.get("video") as File;
    const title = (formData.get("title") as string) || "Untitled video";
    const description = (formData.get("description") as string) || "Untitled description";
    const hashtags = (formData.get("hashtags") as string)?.split(",") || [];
    const thumbnail = formData.get("thumbnail") as File;
 console.log(thumbnail)
    if (!videoFile || typeof videoFile.name !== "string") {
      return NextResponse.json({ error: "Invalid or missing video file" }, { status: 400 });
    }

    const arrayBuffer = await videoFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const tempPath = `/tmp/${uuidv4()}-${videoFile.name}`;
    await writeFile(tempPath, buffer);

    oauth2Client.setCredentials({
      access_token: user.googleAccessToken,
      refresh_token: user.googleRefreshToken,
    });

    // Update token if refreshed
   const { credentials } = await oauth2Client.refreshAccessToken();

  if (!credentials.access_token) {
    return NextResponse.json({ error: "Token refresh failed" }, { status: 401 });
  }

  // Update the token in DB if it's new
  await prisma.user.update({
    where: { email: session.user.email },
    data: { googleAccessToken: credentials.access_token },
  });

  // Re-apply the refreshed credentials
  oauth2Client.setCredentials(credentials);
    const youtube = google.youtube({ version: "v3", auth: oauth2Client });

    // ✅ Get valid categoryId dynamically
    let categoryId = "24"; // Default fallback
    try {
      const categoriesRes = await youtube.videoCategories.list({
        part: ["snippet"],
        regionCode: "IN", // or "IN" for India
      });

      const categories = categoriesRes.data.items;
      if (categories?.length) {
        const match = categories.find(
          (c) => c.snippet?.title === "Entertainment" && c.snippet?.assignable
        );
        if (match?.id) categoryId = match.id;
      }
    } catch (err) {
      console.warn("Failed to fetch categories, using default:", err);
    }

    const uploadRes = await youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title,
          description,
          tags: hashtags,
          categoryId,
        },
        status: {
          privacyStatus: "private",
        },
      },
      media: {
        body: fs.createReadStream(tempPath),
      },
    });
console.log(uploadRes)
    await unlink(tempPath);
if (
  thumbnail &&
  typeof thumbnail.name === "string" &&
  typeof uploadRes.data.id === "string"
) {
  const thumbArrayBuffer = await thumbnail.arrayBuffer();
  const thumbBuffer = Buffer.from(thumbArrayBuffer);
  const thumbTempPath = `/tmp/${uuidv4()}-${thumbnail.name}`;

  await writeFile(thumbTempPath, thumbBuffer);

  await youtube.thumbnails.set({
    videoId: uploadRes.data.id,
    media: {
      mimeType: "image/jpeg",
      body: fs.createReadStream(thumbTempPath),
    },
  });

  await unlink(thumbTempPath); 
}

    return NextResponse.json({ videoId: uploadRes.data.id, message: "Video uploaded successfully" });
  } catch (error: any) {
    console.error("Upload Error:", error);
    return NextResponse.json(
      { error: "Something went wrong", details: error.message },
      { status: 500 }
    );
  }
}
