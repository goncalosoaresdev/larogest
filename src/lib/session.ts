import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { authHeadersFrom } from "@/lib/request-auth";

export type AuthSession = NonNullable<Awaited<ReturnType<typeof getSession>>>;
export type SessionRole = "STAFF" | "OWNER";

export async function getSession(request?: Request) {
  return auth.api.getSession({
    headers: request ? authHeadersFrom(request) : await headers(),
  });
}

export function getSessionRole(session: Awaited<ReturnType<typeof getSession>> | null | undefined): SessionRole | null {
  if (!session?.user) return null;
  if (session.user.role === "OWNER") return "OWNER";
  if (session.user.role === "STAFF") return "STAFF";
  return null;
}

export async function requireSession() {
  const session = await getSession();
  const role = getSessionRole(session);
  if (!session || !role) {
    redirect("/login");
  }
  if (role === "OWNER") {
    redirect("/casa");
  }
  return session;
}

export async function requireStaffSession() {
  return requireSession();
}

export async function requireOwnerSession() {
  const session = await getSession();
  const role = getSessionRole(session);
  if (!session || !role) {
    redirect("/casa/entrar");
  }
  if (role !== "OWNER") {
    redirect("/pulse");
  }
  return session;
}
