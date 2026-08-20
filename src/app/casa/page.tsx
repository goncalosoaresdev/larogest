import { redirect } from "next/navigation";
import { CasaEmpty } from "@/components/casa-empty";
import { listOwnerHouses } from "@/lib/casa";
import { requireOwnerSession } from "@/lib/session";

export default async function CasaHomePage() {
  const session = await requireOwnerSession();
  const houses = await listOwnerHouses(session.user.id);
  if (houses.length === 0) return <CasaEmpty />;
  redirect(`/casa/${houses[0].siteId}`);
}
