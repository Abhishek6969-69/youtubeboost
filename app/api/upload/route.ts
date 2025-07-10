import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getServerSession } from 'next-auth';
import { Readable } from 'stream';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

declare module 'next-auth' {
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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const accessToken = session.user.accessToken;
    const refreshToken = session.user.refreshToken;

    if (!accessToken && !refreshToken) {
      return NextResponse.json(
        { error: 'Missing tokens. Please re-authenticate.', requiresReauth: true },
        { status: 401 }
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    // Refresh token if needed
    if (!accessToken || (session.user.expiryDate && session.user.expiryDate < Date.now())) {
      const { credentials } = await oauth2Client.refreshAccessToken();
      if (!credentials.access_token) {
        return NextResponse.json(
          { error: 'Token refresh failed. Please re-authenticate.', requiresReauth: true },
          { status: 401 }
        );
      }

      await prisma.user.update({
        where: { email: session.user.email },
        data: {
          googleAccessToken: credentials.access_token,
          googleRefreshToken: credentials.refresh_token || refreshToken,
          updatedAt: new Date(),
        },
      });

      oauth2Client.setCredentials(credentials);
    }

    const formData = await request.formData();
    const videoFile = formData.get('video') as File;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const videoId = formData.get('videoId') as string;
    const privacyStatus = formData.get('privacyStatus') as string;

    if (!videoFile || !title || !description || !videoId) {
      return NextResponse.json({ error: 'Missing video, title, description, or videoId.' }, { status: 400 });
    }

    // Updated validation to include 'unlisted'
    if (!['public', 'private', 'unlisted'].includes(privacyStatus)) {
      return NextResponse.json(
        { error: "Invalid privacy status. Must be 'public', 'private', or 'unlisted'." },
        { status: 400 }
      );
    }

    const numericVideoId = Number(videoId);
    if (isNaN(numericVideoId)) {
      return NextResponse.json({ error: 'Invalid videoId' }, { status: 400 });
    }

    const videoRecord = await prisma.video.findUnique({ where: { id: numericVideoId } });
    if (!videoRecord) {
      return NextResponse.json({ error: 'Video ID not found in database' }, { status: 404 });
    }

    const buffer = Buffer.from(await videoFile.arrayBuffer());
    const stream = Readable.from(buffer);

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    const uploadResponse = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title,
          description,
        },
        status: {
          privacyStatus,
        },
      },
      media: {
        body: stream,
      },
    });

    const youtubeVideoId = uploadResponse.data.id;

    await prisma.video.update({
      where: { id: numericVideoId },
      data: {
        youtubeVideoId,
        status: 'uploaded',
      },
    });

    return NextResponse.json({
      success: true,
      videoId: youtubeVideoId,
      message: 'Video uploaded to YouTube successfully.',
    });
  } catch (error: any) {
    console.error('YouTube Upload Error:', JSON.stringify(error, null, 2));

    if (error.code === 401) {
      return NextResponse.json(
        { error: 'Unauthorized. Re-authenticate.', requiresReauth: true },
        { status: 401 }
      );
    }
    if (error.code === 403) {
      return NextResponse.json(
        { error: 'YouTube API quota exceeded or insufficient permissions.' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Upload failed', details: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}