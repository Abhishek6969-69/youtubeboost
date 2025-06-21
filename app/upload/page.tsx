 'use client';

import { useState } from 'react';
// import { useEffect } from 'react'; // Not strictly needed for this component

export default function UploadVideo() {
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null); // State to store error messages

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setThumbnailUrl('');
    setError(null); // Clear previous errors

    const formData = new FormData(e.currentTarget);
    const videoFile = formData.get("video");

    if (!videoFile) {
      setError("Please select a video file.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/thumbnail', {
        method: 'POST',
        body: formData,
      });

      console.log('Response status:', res.status);
      const data: { thumbnailUrl?: string; error?: string } = await res.json();

      if (res.ok && data.thumbnailUrl) {
        setThumbnailUrl(data.thumbnailUrl);
      } else {
        const errorMessage = data.error || 'Failed to generate thumbnail.';
        console.error(errorMessage);
        setError(errorMessage); // Set the error message
      }
    } catch (uploadError) {
      console.error('Upload error:', uploadError);
      setError(`An unexpected error occurred during upload: ${(uploadError as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-12 p-6 bg-white shadow-lg rounded-2xl border border-gray-200">
      <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">
        Upload Video & Generate Thumbnail
      </h1>

      <form onSubmit={handleUpload} className="flex flex-col items-center gap-4">
        <input
          type="file"
          name="video"
          accept="video/*"
          required
          className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"
        />

        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:bg-gray-400"
        >
          {loading ? 'Generating...' : 'Upload & Generate'}
        </button>
      </form>

      {error && ( // Display error messages
        <div className="mt-4 text-center text-red-600">
          <p>{error}</p>
        </div>
      )}

      {thumbnailUrl && (
        <div className="mt-8 text-center">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Generated Thumbnail:</h3>
          <img
            src={thumbnailUrl}
            alt="Generated thumbnail"
            className="rounded-lg border shadow w-full max-w-xs mx-auto"
          />
        </div>
      )}
    </div>
  );
}