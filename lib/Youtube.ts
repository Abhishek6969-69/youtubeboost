import { google } from "googleapis";
import fs from "fs";
// import { OAuth2Client } from "google-auth-library";
import prisma from "@/lib/prisma";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export async function refreshAccessToken(userId: string) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.googleRefreshToken) {
      throw new Error("No refresh token found");
    }
    oauth2Client.setCredentials({ refresh_token: user.googleRefreshToken });
    const {credentials} = await oauth2Client.refreshAccessToken();
    await prisma.user.update({
      where: { id: userId },
      data: {
        googleAccessToken: credentials.access_token!,
        expiryDate: credentials.expiry_date,
        updatedAt: new Date(),
      },
    });
    oauth2Client.setCredentials(credentials);
    return credentials;
  } catch (error) {
    console.error("Error refreshing access token:", error);
    throw new Error("Failed to refresh access token");
  }
}

export async function uploadVideo(
  videoPath: string,
  thumbnailPath: string,
  title: string,
  description: string,
  hashtags: string[],
  userId: string
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.googleAccessToken) {
    throw new Error("No tokens found for user");
  }
  oauth2Client.setCredentials({
    access_token: user.googleAccessToken,
    refresh_token: user.googleRefreshToken,
    expiry_date: user.expiryDate,
  });

  if (user.expiryDate && user.expiryDate < Date.now()) {
    await refreshAccessToken(userId);
  }

  const youtube = google.youtube({ version: "v3", auth: oauth2Client });

  try {
    const videoResponse = await youtube.videos.insert({
      part: ["snippet,status"],
      requestBody: {
        snippet: {
          title,
          description,
          tags: hashtags,
          categoryId: "22",
          defaultLanguage: "en",
          defaultAudioLanguage: "en",
        },
        status: { privacyStatus: "private" },
      },
      media: { body: fs.createReadStream(videoPath) },
    });

    await youtube.thumbnails.set({
      videoId: videoResponse.data.id!,
      media: { body: fs.createReadStream(thumbnailPath) },
    });

    // Update Video model with YouTube video ID
    await prisma.video.update({
      where: { filePath: videoPath },
      data: {
        youtubeVideoId: videoResponse.data.id,
        status: "uploaded",
        updatedAt: new Date(),
      },
    });

    return videoResponse.data.id;
  } catch (error) {
    console.error("Error uploading video:", error);
    throw new Error("Failed to upload video to YouTube");
  }
}