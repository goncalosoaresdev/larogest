import { jsonError, jsonOk, limited, ownerAuthErrorCode, parseJsonBody } from "@/lib/api";
import { auth } from "@/lib/auth";
import { listOwnerHouses } from "@/lib/casa";
import { authHeadersFrom } from "@/lib/request-auth";
import { ownerOtpVerifySchema } from "@/lib/validations";

export async function POST(request: Request) {
  const blocked = limited(request, "casa-auth-verify", 30);
  if (blocked) return blocked;
  try {
    const body = await parseJsonBody<unknown>(request);
    const parsed = ownerOtpVerifySchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, ownerAuthErrorCode(parsed.error.issues));
    }

    let signedIn;
    try {
      signedIn = await auth.api.signInEmailOTP({
        body: { email: parsed.data.email, otp: parsed.data.otp },
        headers: authHeadersFrom(request),
      });
    } catch {
      return jsonError(401, "invalid_otp");
    }

    const role = "role" in signedIn.user ? signedIn.user.role : undefined;
    if (!signedIn.token || role !== "OWNER") {
      return jsonError(401, "invalid_otp");
    }

    const houses = await listOwnerHouses(signedIn.user.id);
    return jsonOk({
      token: signedIn.token,
      user: {
        id: signedIn.user.id,
        name: signedIn.user.name,
        email: signedIn.user.email,
      },
      houses,
    });
  } catch (error) {
    console.error(error);
    return jsonError(500, "server_error");
  }
}
