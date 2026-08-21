type HeaderReader = { get(name: string): string | null };

function headerReader(source: Request | HeaderReader): HeaderReader {
  if ("headers" in source && typeof source.headers?.get === "function") {
    return source.headers;
  }
  return source as HeaderReader;
}

export function requestIp(source: Request | HeaderReader) {
  const headers = headerReader(source);
  const forwarded = headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}

export function isCasaAuthApiPath(pathname: string) {
  return pathname === "/api/casa/auth" || pathname.startsWith("/api/casa/auth/");
}

export function isCasaDemoPath(pathname: string) {
  return (
    pathname === "/casa/demo" ||
    pathname.startsWith("/casa/demo/") ||
    pathname === "/api/casa/demo" ||
    pathname.startsWith("/api/casa/demo/")
  );
}

export function hasBearerAuthorization(source: Request | HeaderReader) {
  const value = headerReader(source).get("authorization")?.trim() ?? "";
  return /^Bearer\s+\S+/i.test(value);
}

export function authHeadersFrom(source: Request | HeaderReader) {
  const incoming = headerReader(source);
  const headers = new Headers();
  for (const name of ["authorization", "cookie", "user-agent", "x-forwarded-for", "x-real-ip"]) {
    const value = incoming.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}
