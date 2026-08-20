import { jsonError, jsonOk, limited, parseJsonBody } from "@/lib/api";
import { sendOwnerSignInOtp } from "@/lib/owner-otp";
import { authHeadersFrom, requestIp } from "@/lib/request-auth";
import { ownerOtpEmailSchema } from "@/lib/validations";

export async function POST(request: Request) {
  const blocked = limited(request, "casa-auth-otp", 20);
  if (blocked) return blocked;
  try {
    const body = await parseJsonBody<unknown>(request);
    const parsed = ownerOtpEmailSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, parsed.error.issues[0]?.message ?? "Email inválido");
    }

    const result = await sendOwnerSignInOtp(parsed.data.email, {
      ip: requestIp(request),
      headers: authHeadersFrom(request),
    });
    if (!result.ok) {
      if (result.error === "rate_limit") return jsonError(429, "Demasiados pedidos");
      return jsonError(400, "Email inválido");
    }
    return jsonOk(result);
  } catch (error) {
    console.error(error);
    return jsonError(500, "Não deu para enviar o código");
  }
}
