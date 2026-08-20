import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { apnsConfig } from "./apns";

describe("apnsConfig", () => {
  it("returns null when any key is missing", () => {
    assert.equal(apnsConfig({}), null);
    assert.equal(
      apnsConfig({
        APNS_KEY_ID: "ABC",
        APNS_TEAM_ID: "TEAM",
        APNS_BUNDLE_ID: "pt.laro.pulse",
      }),
      null,
    );
  });

  it("reads sandbox vs production from APNS_PRODUCTION", () => {
    const env = {
      APNS_KEY_ID: "ABC",
      APNS_TEAM_ID: "TEAM",
      APNS_BUNDLE_ID: "pt.laro.pulse",
      APNS_P8: "key-material",
    };
    assert.equal(apnsConfig(env)?.production, false);
    assert.equal(apnsConfig({ ...env, APNS_PRODUCTION: "true" })?.production, true);
  });
});
