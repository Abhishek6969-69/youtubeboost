import UploadForm from "@/components/uploadForm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Header } from "@/components/ui/header";
import Heading from "@/components/ui/Heading";
export default async function Home() {
  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email || "Guest";

  return (
    <main
      className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900
 text-white flex flex-col"
    >
      <Header />
      <Heading/>
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="max-w-2xl w-full text-center space-y-6 backdrop-blur-sm bg-white/5 p-10 rounded-2xl shadow-lg border border-white/10">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Welcome, <span className="text-white">{userEmail}</span>
          </h1>
          <p className="text-white text-lg">
            Upload your YouTube videos and let us handle the metadata and
            thumbnail for you.
          </p>

          <div className="mt-8">
            <UploadForm />
          </div>
        </div>
      </div>
    </main>
  );
}
