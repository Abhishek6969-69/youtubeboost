import * as thumbsupply from 'thumbsupply';
import path from 'path';
import { promises as fs } from 'fs';

/**
 * Generates a thumbnail and returns a public URL to access it.
 */
export async function generateThumbnail(videoPath: string): Promise<string> {
  const thumbnailDir = path.join(process.cwd(), 'public', 'uploads', 'thumbnails');
  await fs.mkdir(thumbnailDir, { recursive: true });

  const filename = `thumb-${Date.now()}.jpg`;
  const finalThumbnailPath = path.join(thumbnailDir, filename);

  const tempThumbnailPath = await thumbsupply.generateThumbnail(videoPath, {
    size: thumbsupply.ThumbSize.LARGE,
    timestamp: '00:00:01',
    cacheDir: thumbnailDir,
  });

  await fs.rename(tempThumbnailPath, finalThumbnailPath);

  // ✅ Return the relative URL (not filesystem path)
  return `/uploads/thumbnails/${filename}`;
}
