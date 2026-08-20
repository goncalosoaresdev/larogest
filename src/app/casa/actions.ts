"use server";

import { headers } from "next/headers";
import { sendOwnerSignInOtp, type RequestOwnerOtpResult } from "@/lib/owner-otp";
import { authHeadersFrom, requestIp } from "@/lib/request-auth";

export type { RequestOwnerOtpResult };

export async function requestOwnerOtp(email: string): Promise<RequestOwnerOtpResult> {
  const headerStore = await headers();
  return sendOwnerSignInOtp(email, {
    ip: requestIp(headerStore),
    headers: authHeadersFrom(headerStore),
  });
}
