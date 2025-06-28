import { Header } from "@/components/ui/header";
import UploadForm from "@/components/uploadForm";

export async function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white flex flex-col relative overflow-hidden">
      {/* Background Glow Effects */}
      <div className="absolute top-[-100px] left-[-100px] w-[300px] h-[300px] bg-pink-500 rounded-full blur-3xl opacity-20 animate-pulse -z-10" />
      <div className="absolute bottom-[-100px] right-[-100px] w-[300px] h-[300px] bg-indigo-500 rounded-full blur-3xl opacity-20 animate-pulse delay-200 -z-10" />

      <Header />

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className=" w-full text-center space-y-8 ">
          <p className="text-zinc-200 text-lg">
            Upload your YouTube videos and let{" "}
            <span className="text-indigo-300 font-semibold">YouTubeBoost</span>{" "}
            handle AI-powered metadata generation and thumbnail optimization.
          </p>

          <div className="pt-6 w-full">
            <UploadForm />
          </div>
        </div>
      </div>
    </main>
  );
}
