// app/api/thumbnail/route.ts
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { generateThumbnail } from '@/lib/thumbnail';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const videoFile = formData.get('video') as File;

    if (!videoFile || !(videoFile instanceof File)) {
      return NextResponse.json({ error: 'No video file provided' }, { status: 400 });
    }

    // Ensure secure filename
    const originalName = path.basename(videoFile.name);
    const timestamp = Date.now();
    const filename = `${timestamp}-${originalName}`;

    // Create upload directory
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'videos');
    await fs.mkdir(uploadDir, { recursive: true });

    // Convert File to Buffer and write to disk
    const arrayBuffer = await videoFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const videoFilePath = path.join(uploadDir, filename);
    await fs.writeFile(videoFilePath, buffer);

    // Generate thumbnail
    const thumbnailRelativePath = await generateThumbnail(videoFilePath); // e.g. /uploads/thumbnails/thumb-123.jpg

    // Build full public URL
    const baseUrl = req.headers.get('origin') || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const thumbnailUrl = `${baseUrl}${thumbnailRelativePath}`;

    return NextResponse.json({ thumbnailUrl }, { status: 200 });
  } catch (error) {
    console.error('Thumbnail generation error:', error);
    return NextResponse.json(
      { error: `Failed to generate thumbnail: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
