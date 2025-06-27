'use client';
import { useState } from "react";
import axios from "axios";
import { useSession, signIn } from "next-auth/react";

export default function UploadForm() {
  const { data: session } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category,setCategory]=useState('');
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null); // Store thumbnail as File
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null); // For preview
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

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

      const data = response.data as {
        title: string;
        description: string;
        thumbnail: string; // Basename of thumbnail
        videoPath: string;
        hashtags: string[];
        category:string
      };
      setTitle(data.title);
      setDescription(data.description);
      setCategory(data.category)
      setThumbnailUrl(`/uploads/thumbnails/${encodeURIComponent(data.thumbnail)}`);

      // Fetch the thumbnail file from the server
      const thumbnailResponse = await fetch(`/uploads/thumbnails/${encodeURIComponent(data.thumbnail)}`);
      const blob = await thumbnailResponse.blob();
      const thumbnailFile = new File([blob], data.thumbnail, { type: blob.type });
      setThumbnailFile(thumbnailFile);

      setHashtags(data.hashtags);
      setMessage("Metadata generated successfully!");
    } catch (error: any) {
      setMessage(error.response?.data?.error || "Error generating metadata.");
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
    if (!file || !title || !description || !thumbnailFile) {
      setMessage("Please generate metadata first.");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("video", file);
    formData.append("title", title);
    formData.append('category',category);
    formData.append("description", description);
    formData.append("thumbnail", thumbnailFile); // Send File object
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
    } catch (error: any) {
      setMessage(error.response?.data?.error || "Failed to upload video.");
      console.error("Upload error:", error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4">
      {/* {JSON.stringify(session)} */}
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
          <button
            onClick={handleGenerateMetadata}
            disabled={uploading}
            className={`bg-blue-500 text-white p-2 rounded mb-4 w-full ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {uploading ? "Generating..." : "Generate Metadata"}
          </button>
          {title && (
            <div className="mb-4">
              <p><strong>Title:</strong> {title}</p>
              <p><strong>Description:</strong> {description}</p>
              <p><strong>Hashtags:</strong> {hashtags.join(", ")}</p>
                <p><strong>category:</strong> {category}</p>
              {thumbnailUrl && (
                <img
                  src={thumbnailUrl}
                  alt="Thumbnail"
                  className="w-32 h-18 mt-2"
                />
              )}
            </div>
          )}
          <button
            onClick={handleUpload}
            disabled={uploading || !title}
            className={`bg-green-500 text-white p-2 rounded w-full ${uploading || !title ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {uploading ? "Uploading..." : "Upload to YouTube"}
          </button>
        </>
      )}
      {message && (
        <p className={`mt-4 ${message.includes("Error") || message.includes("Failed") ? "text-red-500" : "text-green-500"}`}>
          {message}
        </p>
      )}
    </div>
  );
}