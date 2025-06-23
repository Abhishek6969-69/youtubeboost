// app/api/auth/[...nextauth]/route.ts
import { NextRequest } from "next/server";
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// Initialize NextAuth with authOptions
const handler = NextAuth(authOptions);

// Export handlers for GET and POST
export async function GET(req: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) {
  const resolvedParams = await context.params; // Await params
  return handler(req, { ...context, params: resolvedParams });
}

export async function POST(req: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) {
  const resolvedParams = await context.params; // Await params
  return handler(req, { ...context, params: resolvedParams });
}