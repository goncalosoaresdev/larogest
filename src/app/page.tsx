import { redirect } from "next/navigation";
import { getSession, getSessionRole } from "@/lib/session";

export default async function HomePage() {
  const session = await getSession();
  const role = getSessionRole(session);
  if (role === "OWNER") redirect("/casa");
  if (role === "STAFF") redirect("/leads");
  redirect("/login");
}
