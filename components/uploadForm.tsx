'use client';

import { useState } from 'react';
import axios from 'axios';
import { useSession, signIn } from 'next-auth/react';
import { Sparkles, Target, TrendingUp, Zap } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  const [videoId, setVideoId] = useState<string | null>(null);
  const [privacyStatus, setPrivacyStatus] = useState('private');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFile(e.target.files[0]);
  };

  const handleGenerateMetadata = async () => {
    if (!session) return signIn('google');
    if (!file) return setMessage('Please select a video file.');

    setUploading(true);
    setMessage('Generating metadata and thumbnail...');

    const formData = new FormData();
    formData.append('video', file);
    formData.append('context', context || file.name);

    try {
      const response = await axios.post('/api/generateMetadata', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });

      const data = response.data as {
        title: string;
        description: string;
        category: string;
        hashtags: string[];
        thumbnail?: string;
        videoId: string;
      };

      setTitle(data.title);
      setDescription(data.description);
      setCategory(data.category);
      setHashtags(data.hashtags);
      setVideoId(data.videoId);

      if (data.thumbnail) {
        setThumbnailUrl(data.thumbnail);
        try {
          const res = await fetch(data.thumbnail);
          const blob = await res.blob();
          const thumbFile = new File([blob], `thumbnail-${Date.now()}.jpg`, { type: 'image/jpeg' });
          setThumbnailFile(thumbFile);
        } catch (err) {
          console.error('Thumbnail fetch error:', err);
        }
      }

      setMessage('✅ Metadata and thumbnail generated!');
    } catch (err: any) {
      console.error('Metadata generation failed:', err);
      setMessage(
        err.code === 'ECONNABORTED'
          ? 'Request timed out. Try a smaller file.'
          : err.response?.data?.error || 'Error generating metadata.'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async () => {
    if (!session) return signIn('google');
    if (!file || !title || !description || !videoId)
      return setMessage('Please generate metadata first.');

    setUploading(true);
    setMessage('Uploading to YouTube...');

    const formData = new FormData();
    formData.append('video', file);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('hashtags', hashtags.join(','));
    formData.append('videoId', videoId);
    formData.append('privacyStatus', privacyStatus);

    if (thumbnailFile) formData.append('thumbnail', thumbnailFile);

    try {
      const res = await axios.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });

      const data = res.data as { authUrl?: string; videoId?: string };

      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else if (data.videoId) {
        setVideoId(data.videoId);
        setMessage('✅ Video uploaded successfully!');
      } else {
        setMessage('Video uploaded, but no video ID returned.');
      }
    } catch (err: any) {
      console.error('Upload failed:', err);
      setMessage(
        err.code === 'ECONNABORTED'
          ? 'Upload timed out. Please try again.'
          : err.response?.data?.error || 'Failed to upload video.'
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-8 px-4 pb-10">
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
              <Input
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                disabled={uploading}
              />
              {file && (
                <p className="text-sm text-muted-foreground">
                  Selected: {file.name} ({Math.round(file.size / 1024 / 1024)}MB)
                </p>
              )}

              <textarea
                className="w-full rounded border p-2 min-h-[100px] text-sm"
                placeholder="Add optional context for better AI suggestions"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                disabled={uploading}
                rows={4}
              />

              <div className="space-y-2">
                <label className="text-sm font-medium">Privacy Status</label>
                <Select value={privacyStatus} onValueChange={setPrivacyStatus} disabled={uploading}>
                  <SelectTrigger className="w-full" />
                  <SelectContent>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="unlisted">Unlisted</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleGenerateMetadata}
                disabled={uploading || !file}
                className="w-full"
              >
                {uploading ? 'Generating...' : 'Generate Metadata & Thumbnail'}
              </Button>
            </CardContent>
          </Card>

          {title && (
            <div className="grid gap-4 md:grid-cols-2 w-full max-w-4xl">
              <GeneratedFeatureCards
                tit="AI Powered Title"
                des={title}
                icon={<Sparkles className="w-5 h-5" />}
              />
              <GeneratedFeatureCards
                tit="Description"
                des={description}
                icon={<Target className="w-5 h-5" />}
              />
              <GeneratedFeatureCards
                tit="Hashtags"
                des={hashtags.join(', ')}
                icon={<TrendingUp className="w-5 h-5" />}
              />
              <GeneratedFeatureCards
                tit="Category"
                des={category}
                icon={<Zap className="w-5 h-5" />}
              />
            </div>
          )}

          {thumbnailUrl && (
            <Card className="w-full max-w-2xl">
              <CardHeader>
                <CardTitle className="text-lg">Generated Thumbnail</CardTitle>
              </CardHeader>
              <CardContent>
                <img
                  src={thumbnailUrl}
                  alt="Generated Thumbnail"
                  className="w-full rounded-lg shadow-md"
                />
              </CardContent>
            </Card>
          )}

          <Button
            onClick={handleUpload}
            disabled={uploading || !title}
            className="w-full max-w-2xl"
          >
            {uploading ? 'Uploading...' : 'Upload to YouTube'}
          </Button>
        </>
      )}

      {message && (
        <div
          className={`p-4 rounded-lg text-sm max-w-2xl w-full ${
            message.includes('Error') || message.includes('Failed') || message.includes('timed out')
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-green-50 text-green-700 border border-green-200'
          }`}
        >
          {message}
        </div>
      )}

      {videoId && (
        <Card className="w-full max-w-2xl">
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Your video has been uploaded successfully!
            </p>
            <a
              href={`https://www.youtube.com/watch?v=${videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
              View on YouTube
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  );
}