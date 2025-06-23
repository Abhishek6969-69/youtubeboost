"use client";

import { useState } from "react";
import axios from "axios";
import { useSession, signIn } from "next-auth/react";

export default function UploadForm() {
  const { data: session } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [check, setcheck] = useState<any>();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleGenerateMetadata = async () => {
    if (!session) {
      signIn("google");
      return;
    }
    if (!file) {
      setMessage("Please select a video file.");
      return;
    }

    setUploading(true);
    const formData = new FormData();

    formData.append("video", file);
    formData.append("context", file.name);

    try {
      const response = await axios.post("/api/generateMetadata", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setcheck(response)
      const data = response.data as {
        title: string;
        description: string;
        thumbnail: string;
        videoPath: string;
        hashtags: string[];
      };
      setTitle(data.title);
      setDescription(data.description);
      setThumbnail(data.thumbnail);
      setVideoPath(data.videoPath);
      setHashtags(data.hashtags);
      setMessage("Metadata generated successfully!");
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "response" in error) {
        const err = error as { response?: { data?: { authUrl?: string } } };
        setMessage(err.response?.data?.authUrl ? "Please sign in." : "Error generating metadata.");
      } else {
        setMessage("Error generating metadata.");
      }
      console.error("Metadata error:", error);
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async () => {
    if (!session) {
      signIn("google");
      return;
    }
    if (!file || !title || !description || !thumbnail || !videoPath) {
      setMessage("Please generate metadata first.");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("video", file);
    formData.append("title", title);
    formData.append("description", description);
    formData.append("thumbnail", thumbnail);
    formData.append("hashtags", JSON.stringify(hashtags));

    try {
      const response = await axios.post("/api/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const data = response.data as { authUrl?: string; videoId?: string };

      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setMessage(`Video uploaded successfully! Video ID: ${data.videoId}`);
      }
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && "response" in error) {
        const err = error as { response?: { data?: { authUrl?: string } } };
        setMessage(err.response?.data?.authUrl ? "Please sign in." : "Failed to upload video.");
      } else {
        setMessage("Failed to upload video.");
      }
      console.error("Upload error:", error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Upload Video to YouTube</h1>
      {!session ? (
        <button
          onClick={() => signIn("google")}
          className="bg-blue-500 text-white p-2 rounded w-full mb-4"
        >
          Sign in with Google
        </button>
      ) : (
        <>
          <input
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            className="mb-4 p-2 border w-full"
          />
          {JSON.stringify(check)}
          <button
            onClick={handleGenerateMetadata}
            disabled={uploading}
            className="bg-blue-500 text-white p-2 rounded mb-4 w-full"
          >
            {uploading ? "Generating..." : "Generate Metadata"}
          </button>
          {title && (
            <div className="mb-4">
              <p><strong>Title:</strong> {title}</p>
              <p><strong>Description:</strong> {description}</p>
              <p><strong>Hashtags:</strong> {hashtags.join(", ")}</p>
              {thumbnail && (
                <img src={`file://${thumbnail}`} alt="Thumbnail" className="w-32 h-18 mt-2" />
              )}
            </div>
          )}
          <button
            onClick={handleUpload}
            disabled={uploading || !title}
            className="bg-green-500 text-white p-2 rounded w-full"
          >
            {uploading ? "Uploading..." : "Upload to YouTube"}
          </button>
        </>
      )}
      {message && <p className="mt-4 text-red-500">{message}</p>}
    </div>
  );
}