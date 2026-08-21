import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authHeadersFrom, hasBearerAuthorization, isCasaAuthApiPath, isCasaDemoPath, requestIp } from "./request-auth";

describe("isCasaAuthApiPath", () => {
  it("matches only the owner auth API prefix", () => {
    assert.equal(isCasaAuthApiPath("/api/casa/auth/otp"), true);
    assert.equal(isCasaAuthApiPath("/api/casa/auth/verify"), true);
    assert.equal(isCasaAuthApiPath("/api/casa/auth"), true);
    assert.equal(isCasaAuthApiPath("/api/casa"), false);
    assert.equal(isCasaAuthApiPath("/api/casa/abc/live"), false);
    assert.equal(isCasaAuthApiPath("/api/auth/sign-in/email-otp"), false);
  });
});

describe("isCasaDemoPath", () => {
  it("matches the public demo page and API prefix", () => {
    assert.equal(isCasaDemoPath("/casa/demo"), true);
    assert.equal(isCasaDemoPath("/api/casa/demo/live"), true);
    assert.equal(isCasaDemoPath("/casa/entrar"), false);
    assert.equal(isCasaDemoPath("/api/casa/abc/live"), false);
  });
});

describe("hasBearerAuthorization", () => {
  it("accepts a Bearer token and rejects missing or empty values", () => {
    assert.equal(hasBearerAuthorization(new Headers({ authorization: "Bearer abc.def" })), true);
    assert.equal(hasBearerAuthorization(new Request("http://localhost", { headers: { authorization: "bearer token" } })), true);
    assert.equal(hasBearerAuthorization(new Headers({ authorization: "Bearer " })), false);
    assert.equal(hasBearerAuthorization(new Headers({ authorization: "Basic abc" })), false);
    assert.equal(hasBearerAuthorization(new Headers()), false);
  });
});

describe("requestIp", () => {
  it("prefers the first forwarded address", () => {
    assert.equal(requestIp(new Headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" })), "1.1.1.1");
    assert.equal(requestIp(new Headers({ "x-real-ip": "9.9.9.9" })), "9.9.9.9");
    assert.equal(requestIp(new Headers()), "unknown");
  });
});

describe("authHeadersFrom", () => {
  it("copies auth headers and drops origin", () => {
    const headers = authHeadersFrom(
      new Headers({
        authorization: "Bearer tok",
        cookie: "a=1",
        origin: "https://evil.example",
        referer: "https://evil.example/login",
        "user-agent": "LaroPulse/1.0",
      }),
    );
    assert.equal(headers.get("authorization"), "Bearer tok");
    assert.equal(headers.get("cookie"), "a=1");
    assert.equal(headers.get("user-agent"), "LaroPulse/1.0");
    assert.equal(headers.get("origin"), null);
    assert.equal(headers.get("referer"), null);
  });
});
