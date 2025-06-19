import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import prisma from "@/lib/prisma";

// Extend NextAuth types to include custom user/session properties
declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      accessToken?: string;
      refreshToken?: string;
      expiryDate?: number | null;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/userinfo.email openid",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }: { token: import("next-auth/jwt").JWT; account?: import("next-auth").Account | null }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiryDate = account.expires_at ? account.expires_at * 1000 : null;

        // Store tokens in User model
        await prisma.user.upsert({
          where: { email: token.email! },
          update: {
            googleAccessToken: account.access_token,
            googleRefreshToken: account.refresh_token,
            updatedAt: new Date(),
          },
          create: {
            id: token.sub!,
            email: token.email!,
            googleAccessToken: account.access_token,
            googleRefreshToken: account.refresh_token,
            createdAt: new Date(),
          },
        });
      }
      return token;
    },
    async session({ session, token }: { session: import("next-auth").Session; token: import("next-auth/jwt").JWT }) {
      if (session.user) {
        session.user.id = typeof token.sub === "string" ? token.sub : undefined;
        session.user.accessToken = typeof token.accessToken === "string" ? token.accessToken : undefined;
        session.user.refreshToken = typeof token.refreshToken === "string" ? token.refreshToken : undefined;
        session.user.expiryDate = typeof token.expiryDate === "number" ? token.expiryDate : null;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };