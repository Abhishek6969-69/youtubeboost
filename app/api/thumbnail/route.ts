// app/api/thumbnail/route.ts
import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises'; // Use fs.promises for async operations
import { generateThumbnail } from '@/lib/thumbnail';

export async function POST(req: Request) {
  try {
    // 1. Get formData from the request
    const formData = await req.formData();
    const videoFile = formData.get('video') as File;

    if (!videoFile) {
      return NextResponse.json({ error: 'No video file provided' }, { status: 400 });
    }

    // 2. Create a buffer from the file
    const arrayBuffer = await videoFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Define upload directory and filename
    const uploadDir = path.join(process.cwd(), 'uploads', 'videos');
    await fs.mkdir(uploadDir, { recursive: true });
    const filename = `${Date.now()}-${videoFile.name}`; // Correct filename generation
    const videoFilePath = path.join(uploadDir, filename);

    // 4. Write the file to disk
    await fs.writeFile(videoFilePath, buffer);

    // 5. Generate thumbnail
    const thumbnailUrl = await generateThumbnail(videoFilePath);

    return NextResponse.json({ thumbnailUrl }, { status: 200 });
  } catch (error) {
    console.error('Thumbnail generation error:', error);
    return NextResponse.json({ error: `Failed to generate thumbnail: ${(error as Error).message}` }, { status: 500 });
  }
}