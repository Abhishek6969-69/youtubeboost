'use client';

import { useState } from 'react';
import axios from 'axios';
import { useSession, signIn } from 'next-auth/react';
import { Sparkles, Target, TrendingUp, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { GeneratedFeatureCards } from './ui/generatedfeature';

export default function UploadForm() {
  const { data: session } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [context, setContext] = useState('');
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [videoId, setVideoId] = useState<string | null>(null); // ✅ New state

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFile(e.target.files[0]);
  };

  const handleGenerateMetadata = async () => {
    if (!session) return signIn('google');
    if (!file) return setMessage('Please select a video file.');

    setUploading(true);
    const formData = new FormData();
    formData.append('video', file);
    formData.append('context', context || file.name);

    try {
      const response = await axios.post('/api/generateMetadata', formData);
      const data = response.data as {
        title: string;
        description: string;
        category: string;
        hashtags: string[];
        thumbnail?: string;
        FingMetadata?: string;
      };

      const thumbnailFilename = data.thumbnail ?? data.FingMetadata;
      if (!thumbnailFilename) {
        console.warn('Thumbnail filename is undefined in API response');
        setMessage('Metadata generated, but thumbnail is missing. Please try again.');
        return;
      }

      setTitle(data.title);
      setDescription(data.description);
      setCategory(data.category);
      setHashtags(data.hashtags);

      const thumbPath = `/Uploads/thumbnails/${encodeURIComponent(thumbnailFilename)}`;
      try {
        const fetchResponse = await fetch(thumbPath);
        if (!fetchResponse.ok) {
          throw new Error(`Failed to fetch thumbnail at ${thumbPath}: ${fetchResponse.statusText}`);
        }
        const blob = await fetchResponse.blob();
        setThumbnailUrl(thumbPath);
        setThumbnailFile(new File([blob], thumbnailFilename, { type: blob.type }));
        setMessage('Metadata generated successfully!');
      } catch (fetchError: any) {
        console.error('Thumbnail fetch error:', fetchError);
        setMessage(`Error fetching thumbnail: ${fetchError.message}`);
      }
    } catch (err: any) {
      console.error('Metadata generation error:', err);
      setMessage(err.response?.data?.error || err.message || 'Error generating metadata.');
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async () => {
    if (!session) return signIn('google');
    if (!file || !title || !description || !thumbnailFile) return setMessage('Please generate metadata first.');

    setUploading(true);
    const formData = new FormData();
    formData.append('video', file);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('category', category);
    formData.append('thumbnail', thumbnailFile);
    formData.append('hashtags', JSON.stringify(hashtags));

    try {
      const response = await axios.post('/api/upload', formData);
      const data = response.data as { authUrl?: string; videoId?: string };

      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else if (data.videoId) {
        setVideoId(data.videoId); // ✅ store for rendering link
        setMessage('Video uploaded successfully! You can now view it on YouTube.');
      } else {
        setMessage('Video uploaded, but no video ID returned.');
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setMessage(err.response?.data?.error || 'Failed to upload video.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-8">
      {!session ? (
        <Button onClick={() => signIn('google')} className="w-full max-w-md">
          Sign in with Google
        </Button>
      ) : (
        <>
          <Card className="w-full max-w-2xl">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Get Started</CardTitle>
              <CardDescription>Upload your video and let AI handle the rest</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input type="file" accept="video/*" onChange={handleFileChange} disabled={uploading} />
              <textarea
                className="w-full rounded border p-2"
                placeholder="Enter additional context for metadata generation (optional)"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                disabled={uploading}
                rows={4}
              />
              <Button onClick={handleGenerateMetadata} disabled={uploading} className="w-full">
                {uploading ? 'Generating...' : 'Generate Metadata'}
              </Button>
            </CardContent>
          </Card>

          {title && (
            <div className="grid gap-4 md:grid-cols-2 w-full max-w-4xl">
              <GeneratedFeatureCards tit="AI Powered Title" des={title} icon={<Sparkles />} />
              <GeneratedFeatureCards tit="Description" des={description} icon={<Target />} />
              <GeneratedFeatureCards tit="Hashtags" des={hashtags.join(', ')} icon={<TrendingUp />} />
              <GeneratedFeatureCards tit="Category" des={category} icon={<Zap />} />
            </div>
          )}

          {thumbnailUrl && (
            <div className="flex justify-center">
              <img src={thumbnailUrl} alt="Thumbnail" className="rounded mt-4 max-w-full" />
            </div>
          )}

          <Button onClick={handleUpload} disabled={uploading || !title} className="w-full max-w-2xl">
            {uploading ? 'Uploading...' : 'Upload to YouTube'}
          </Button>
        </>
      )}

      {message && (
        <p
          className={`text-sm ${
            message.includes('Error') || message.includes('Failed') ? 'text-red-500' : 'text-green-500'
          }`}
        >
          {message}
        </p>
      )}

      {videoId && (
        <a
          href={`https://www.youtube.com/watch?v=${videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline text-sm"
        >
          👉 View Uploaded Video on YouTube
        </a>
      )}
    </div>
  );
}
