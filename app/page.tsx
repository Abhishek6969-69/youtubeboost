import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Home } from "@/components/ui/Home";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email || "Guest";

  return (
    <main className=" bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white flex flex-col">
      <Home />
    </main>
  );
}
