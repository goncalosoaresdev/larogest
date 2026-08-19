"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { getIntegrationReports } from "@/lib/iot";

export async function refreshIntegrations(): Promise<void> {
  await requireSession();
  await getIntegrationReports({ fresh: true });
  revalidatePath("/integracoes");
}
