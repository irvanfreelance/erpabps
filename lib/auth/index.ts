import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { resolveGoogleIdentity } from "@/lib/auth/resolve-google";
import type { Role } from "@/types/auth";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const resolved = await resolveGoogleIdentity(user.email, user.name ?? "");
      return Boolean(resolved);
    },
    async jwt({ token, account, profile, user }) {
      if (!account && !user) return token;
      const email = (profile as { email?: string } | undefined)?.email ?? user?.email ?? token.email;
      const name = (profile as { name?: string } | undefined)?.name ?? token.nama ?? user?.name ?? "";
      if (typeof email !== "string") return token;
      try {
        const resolved = await resolveGoogleIdentity(email, name);
        if (resolved) {
          token.id = resolved.id;
          token.nama = resolved.nama;
          token.email = resolved.email;
          token.role = resolved.role;
          token.employeeId = resolved.employeeId;
        }
      } catch {
        /* keep existing token claims if DB is briefly down */
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id && token.role) {
        session.user = {
          id: token.id,
          nama: token.nama ?? session.user?.email ?? "",
          email: (token.email as string) ?? "",
          role: token.role as Role,
          employeeId: token.employeeId ?? null,
        };
      }
      return session;
    },
  },
};
