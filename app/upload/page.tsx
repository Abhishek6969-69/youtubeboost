'use client'
import { useState } from "react";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [context, setContext] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const handleGenerateMetadata = async () => {
    if (!file && !context) {
      setMessage("Please upload a video or provide context");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      if (file) formData.append("video", file);
      formData.append("context", context || file?.name || "Default video context");

      const res = await fetch("/api/generateMetadata", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setTitle(data.title);
        setDescription(data.description);
        setHashtags(data.hashtags);
        setThumbnail(data.thumbnail);
        setVideoPath(data.videoPath);
        setMessage("Video uploaded and metadata generated successfully!");
      } else {
        setMessage(data.error || "Failed to generate metadata");
      }
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-3xl font-bold mb-8">Upload Your Video</h1>
      <div className="w-full max-w-md">
        <input
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="mb-4 p-2 border rounded w-full"
        />
        <input
          type="text"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Enter video context (optional)"
          className="mb-4 p-2 border rounded w-full"
        />
        <button
          onClick={handleGenerateMetadata}
          disabled={uploading}
          className={`px-4 py-2 bg-blue-500 text-white rounded w-full ${
            uploading ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {uploading ? "Processing..." : "Upload & Generate Metadata"}
        </button>
        {message && <p className={`mt-4 ${message.includes("Error") ? "text-red-500" : "text-green-500"}`}>{message}</p>}
        {title && <p className="mt-4 text-gray-600"><strong>Title:</strong> {title}</p>}
        {description && <p className="mt-2 text-gray-600"><strong>Description:</strong> {description}</p>}
        {thumbnail && (
          <p className="mt-2 text-gray-600">
            <strong>Thumbnail:</strong> <img src={thumbnail} alt="Thumbnail" className="mt-2 max-w-xs" />
          </p>
        )}
        {videoPath && <p className="mt-2 text-gray-600"><strong>Video Path:</strong> {videoPath}</p>}
        {hashtags.length > 0 && (
          <p className="mt-2 text-gray-600"><strong>Hashtags:</strong> {hashtags.join(", ")}</p>
        )}
      </div>
    </main>
  );
}