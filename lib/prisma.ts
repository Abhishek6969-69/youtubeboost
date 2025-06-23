// src/lib/prisma.ts
// "use client";
import { PrismaClient } from "../app/generated/prisma";

declare global {
  var prisma: PrismaClient | undefined;
}

const prisma = global.prisma || new PrismaClient({
  log: ["query"], // Optional: Enable query logging for debugging
});

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

export default prisma;
// npg_p5SNTMysde8c