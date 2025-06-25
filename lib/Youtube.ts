import { google } from "googleapis";
import { createReadStream } from "fs";
import prisma from "./prisma";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export async function refreshAccessToken(userId: string) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.googleRefreshToken) {
      throw new Error("No refresh token found for user");
    }
    oauth2Client.setCredentials({ refresh_token: user.googleRefreshToken });
    const { credentials } = await oauth2Client.refreshAccessToken();
    await prisma.user.update({
      where: { id: userId },
      data: {
        googleAccessToken: credentials.access_token!,
        updatedAt: new Date(),
      },
    });
    oauth2Client.setCredentials(credentials);
    return credentials.access_token!;
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
  userId: string,
  accessToken: string
): Promise<string> {
  try {
    // Validate file existence
    if (!createReadStream(videoPath).readable) {
      throw new Error(`Video file not found or unreadable: ${videoPath}`);
    }
    if (!createReadStream(thumbnailPath).readable) {
      throw new Error(`Thumbnail file not found or unreadable: ${thumbnailPath}`);
    }

    // Set credentials
    oauth2Client.setCredentials({ access_token: accessToken });

    // Check token validity and refresh if needed
    try {
      await oauth2Client.getAccessToken();
    } catch (error) {
      console.warn("Access token invalid, attempting refresh:", error);
      const newAccessToken = await refreshAccessToken(userId);
      oauth2Client.setCredentials({ access_token: newAccessToken });
    }

    const youtube = google.youtube({ version: "v3", auth: oauth2Client });

    // Upload video
    console.time("YouTubeVideoUpload");
    const videoResponse = await youtube.videos.insert({
      part: ["snippet,status"],
      requestBody: {
        snippet: {
          title,
          description,
          tags: hashtags,
          categoryId: "22", // People & Blogs
          defaultLanguage: "en",
          defaultAudioLanguage: "en",
        },
        status: { privacyStatus: "private" },
      },
      media: { body: createReadStream(videoPath) },
    }).catch((err) => {
      console.error("YouTube video upload error:", {
        code: err.code,
        message: err.message,
        errors: err.errors,
      });
      throw new Error(`Failed to upload video: ${err.message}`);
    });

    const videoId = videoResponse.data.id;
    if (!videoId) {
      throw new Error("No video ID returned from YouTube");
    }

    console.timeEnd("YouTubeVideoUpload");

    // Upload thumbnail
    console.time("YouTubeThumbnailUpload");
    await youtube.thumbnails.set({
      videoId,
      media: { body: createReadStream(thumbnailPath) },
    }).catch((err) => {
      console.error("YouTube thumbnail upload error:", {
        code: err.code,
        message: err.message,
        errors: err.errors,
      });
      throw new Error(`Failed to upload thumbnail: ${err.message}`);
    });
    console.timeEnd("YouTubeThumbnailUpload");

    // Update video record
    console.time("DatabaseUpdate");
    try {
      const videoRecord = await prisma.video.findFirst({ where: { filePath: videoPath } });
      if (!videoRecord) {
        throw new Error(`Video record not found for filePath: ${videoPath}`);
      }
      await prisma.video.update({
        where: { id: videoRecord.id },
        data: {
          youtubeVideoId: videoId,
          status: "UPLOADED",
          updatedAt: new Date(),
        },
      });
    } catch (dbError) {
      console.error("Database update error:", dbError);
      throw new Error("Failed to update video record in database");
    }
    console.timeEnd("DatabaseUpdate");

    return videoId;
  } catch (error) {
    console.error("Error uploading video to YouTube:", error);
    throw error;
  }
}