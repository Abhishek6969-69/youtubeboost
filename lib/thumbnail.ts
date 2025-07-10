import { put } from '@vercel/blob';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Generates a thumbnail using Cloudinary and stores it in Vercel Blob
 * @param videoFile - The video file to generate thumbnail from
 * @returns Promise<string> - The public URL of the thumbnail
 */
export async function generateThumbnail(videoFile: File): Promise<string> {
  try {
    console.log('Starting thumbnail generation for:', videoFile.name);
    
    // Step 1: Upload video to Cloudinary temporarily
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    const base64Video = videoBuffer.toString('base64');
    const dataURI = `data:${videoFile.type};base64,${base64Video}`;
    
    const uploadResult = await cloudinary.uploader.upload(dataURI, {
      resource_type: 'video',
      public_id: `temp_video_${Date.now()}`,
      folder: 'temp_videos',
    });
    
    console.log('Video uploaded to Cloudinary:', uploadResult.public_id);
    
    // Step 2: Generate thumbnail URL from Cloudinary
    const thumbnailUrl = cloudinary.url(uploadResult.public_id, {
      resource_type: 'video',
      format: 'jpg',
      transformation: [
        { quality: 'auto:good' },
        { width: 1280, height: 720, crop: 'fill' },
        { start_offset: '5' } // Extract frame at 5 seconds
      ]
    });
    
    console.log('Thumbnail URL generated:', thumbnailUrl);
    
    // Step 3: Download thumbnail from Cloudinary
    const thumbnailResponse = await fetch(thumbnailUrl);
    if (!thumbnailResponse.ok) {
      throw new Error(`Failed to fetch thumbnail: ${thumbnailResponse.statusText}`);
    }
    
    const thumbnailBuffer = await thumbnailResponse.arrayBuffer();
    const thumbnailBlob = new Blob([thumbnailBuffer], { type: 'image/jpeg' });
    
    // Step 4: Upload thumbnail to Vercel Blob
    const filename = `thumbnail-${Date.now()}.jpg`;
    const blobResult = await put(filename, thumbnailBlob, {
      access: 'public',
      contentType: 'image/jpeg',
    });
    
    console.log('Thumbnail uploaded to Vercel Blob:', blobResult.url);
    
    // Step 5: Clean up temporary video from Cloudinary
    try {
      await cloudinary.uploader.destroy(uploadResult.public_id, {
        resource_type: 'video'
      });
      console.log('Temporary video cleaned up from Cloudinary');
    } catch (cleanupError) {
      console.warn('Failed to cleanup temporary video:', cleanupError);
    }
    
    return blobResult.url;
    
  } catch (error: any) {
    console.error('Thumbnail generation failed:', error);
    throw new Error(`Failed to generate thumbnail: ${error.message}`);
  }
}

/**
 * Alternative method using direct video processing (for smaller files)
 * @param videoFile - The video file
 * @returns Promise<string> - The public URL of the thumbnail
 */
export async function generateThumbnailDirect(videoFile: File): Promise<string> {
  try {
    // This method uploads the video directly and generates thumbnail
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    const base64Video = videoBuffer.toString('base64');
    const dataURI = `data:${videoFile.type};base64,${base64Video}`;
    
    // Upload with automatic thumbnail generation
    const result = await cloudinary.uploader.upload(dataURI, {
      resource_type: 'video',
      public_id: `video_${Date.now()}`,
      folder: 'video_thumbnails',
      eager: [
        {
          width: 1280,
          height: 720,
          crop: 'fill',
          format: 'jpg',
          start_offset: '5'
        }
      ]
    });
    
    // Get the eager transformation URL (thumbnail)
    const thumbnailUrl = result.eager?.[0]?.secure_url || 
                         cloudinary.url(result.public_id, {
                           resource_type: 'video',
                           format: 'jpg',
                           transformation: [
                             { width: 1280, height: 720, crop: 'fill' },
                             { start_offset: '5' }
                           ]
                         });
    
    // Download and upload to Vercel Blob
    const thumbnailResponse = await fetch(thumbnailUrl);
    const thumbnailBuffer = await thumbnailResponse.arrayBuffer();
    const thumbnailBlob = new Blob([thumbnailBuffer], { type: 'image/jpeg' });
    
    const filename = `thumbnail-${Date.now()}.jpg`;
    const blobResult = await put(filename, thumbnailBlob, {
      access: 'public',
      contentType: 'image/jpeg',
    });
    
    // Clean up from Cloudinary
    await cloudinary.uploader.destroy(result.public_id, {
      resource_type: 'video'
    });
    
    return blobResult.url;
    
  } catch (error: any) {
    console.error('Direct thumbnail generation failed:', error);
    throw new Error(`Failed to generate thumbnail: ${error.message}`);
  }
}

/**
 * Upload an existing thumbnail file to Vercel Blob
 * @param thumbnailFile - The thumbnail file to upload
 * @returns Promise<string> - The public URL of the uploaded thumbnail
 */
export async function uploadThumbnailToBlob(thumbnailFile: File): Promise<string> {
  try {
    const filename = `thumbnail-${Date.now()}-${thumbnailFile.name}`;
    const blob = await put(filename, thumbnailFile, {
      access: 'public',
      contentType: thumbnailFile.type,
    });
    
    return blob.url;
  } catch (error: any) {
    console.error('Failed to upload thumbnail to blob:', error);
    throw new Error(`Failed to upload thumbnail: ${error.message}`);
  }
}