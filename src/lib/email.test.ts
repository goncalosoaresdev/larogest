import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EmailSendError,
  parseFromAddress,
  resolveEmailTransport,
  staffEmailError,
} from "./email";

describe("parseFromAddress", () => {
  it("parses display-name form", () => {
    assert.deepEqual(parseFromAddress("Laro <propostas@laro.pt>"), {
      address: "propostas@laro.pt",
      name: "Laro",
    });
  });

  it("parses a bare address", () => {
    assert.deepEqual(parseFromAddress("propostas@laro.pt"), {
      address: "propostas@laro.pt",
    });
  });

  it("rejects a named address without @", () => {
    assert.throws(() => parseFromAddress("Laro <not-an-email>"), EmailSendError);
  });
});

describe("resolveEmailTransport", () => {
  it("uses remote when both credentials are set", () => {
    assert.deepEqual(
      resolveEmailTransport({
        CLOUDFLARE_ACCOUNT_ID: "abc",
        CLOUDFLARE_EMAIL_API_TOKEN: "token",
        NODE_ENV: "production",
      }),
      { mode: "remote", accountId: "abc", apiToken: "token" },
    );
  });

  it("allows local fallback only in development with both vars empty", () => {
    assert.deepEqual(
      resolveEmailTransport({
        CLOUDFLARE_ACCOUNT_ID: "",
        CLOUDFLARE_EMAIL_API_TOKEN: "",
        NODE_ENV: "development",
      }),
      { mode: "local" },
    );
  });

  it("fails closed in production without credentials", () => {
    assert.throws(
      () =>
        resolveEmailTransport({
          NODE_ENV: "production",
        }),
      (error: unknown) => error instanceof EmailSendError && error.code === "not_configured",
    );
  });

  it("treats partial credentials as a misconfiguration", () => {
    assert.throws(
      () =>
        resolveEmailTransport({
          CLOUDFLARE_ACCOUNT_ID: "abc",
          CLOUDFLARE_EMAIL_API_TOKEN: "",
          NODE_ENV: "development",
        }),
      (error: unknown) => error instanceof EmailSendError && error.code === "not_configured",
    );
  });
});

describe("staffEmailError", () => {
  it("surfaces config errors to operators", () => {
    assert.equal(
      staffEmailError(new EmailSendError("not_configured", "Configuração de email em falta.")),
      "Configuração de email em falta.",
    );
  });

  it("hides send failures behind a generic message", () => {
    assert.equal(
      staffEmailError(new EmailSendError("send_failed", "internal")),
      "Não foi possível enviar o email. Tenta outra vez.",
    );
  });
});
