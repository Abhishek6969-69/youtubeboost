import UploadForm from "@/components/uploadForm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function Home() {
  const session = await getServerSession(authOptions);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-3xl font-bold mb-8">
        Welcome, {session ? session.user.email : "Guest"}!
      </h1>
      <UploadForm />
    </main>
  );
}