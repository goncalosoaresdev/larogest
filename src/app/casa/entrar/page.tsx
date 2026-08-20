import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CasaLogin } from "@/components/casa-login";
import { safeCasaNext } from "@/lib/owner-auth-core";
import { getSession, getSessionRole } from "@/lib/session";

export default async function CasaEntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getSession();
  const role = getSessionRole(session);
  const next = (await searchParams).next;
  if (role === "OWNER") redirect(safeCasaNext(typeof next === "string" ? next : null) || "/casa");
  if (role === "STAFF") redirect(safeCasaNext(typeof next === "string" ? next : null) || "/pulse");
  return (
    <Suspense>
      <CasaLogin />
    </Suspense>
  );
}
