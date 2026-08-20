import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  companySchema,
  contractFormSchema,
  leadFormSchema,
  leadStatusSchema,
  proposalFormSchema,
  pulseReadingSchema,
  ownerOtpEmailSchema,
  ownerOtpVerifySchema,
  pulseSiteSchema,
  signContractSchema,
  templateSaveSchema,
} from "./validations";

describe("leadFormSchema", () => {
  it("accepts a valid lead and rejects a short name and bad email", () => {
    const valid = leadFormSchema.safeParse({
      name: "Maria Silva",
      email: "maria@example.com",
      personType: "INDIVIDUAL",
      source: "WEBSITE",
      service: "AL_MANAGEMENT",
      address: "Rua das Flores 1",
      typology: "APARTMENT",
    });
    assert.equal(valid.success, true);

    const shortName = leadFormSchema.safeParse({
      name: "M",
      personType: "INDIVIDUAL",
      source: "MANUAL",
      service: "SCHEDULED_VISITS",
      address: "Porto",
      typology: "HOUSE",
    });
    assert.equal(shortName.success, false);

    const badEmail = leadFormSchema.safeParse({
      name: "Maria Silva",
      email: "not-an-email",
      personType: "INDIVIDUAL",
      source: "MANUAL",
      service: "SCHEDULED_VISITS",
      address: "Porto centro",
      typology: "HOUSE",
    });
    assert.equal(badEmail.success, false);
  });
});

describe("leadStatusSchema", () => {
  it("requires a known status", () => {
    assert.equal(leadStatusSchema.safeParse({ status: "WON" }).success, true);
    assert.equal(leadStatusSchema.safeParse({ status: "MAYBE" }).success, false);
  });
});

describe("proposalFormSchema", () => {
  it("defaults validDays and rejects commission over 100", () => {
    const parsed = proposalFormSchema.parse({
      leadId: "lead-1",
      package: "FULL_MANAGEMENT",
      commissionPct: 18,
      commissionBase: "GROSS",
    });
    assert.equal(parsed.validDays, 14);
    assert.equal(
      proposalFormSchema.safeParse({
        leadId: "lead-1",
        package: "CO_HOST",
        commissionPct: 120,
        commissionBase: "NET",
      }).success,
      false,
    );
  });
});

describe("contractFormSchema", () => {
  it("defaults months and noticeDays", () => {
    const parsed = contractFormSchema.parse({
      proposalId: "p1",
      startsOn: "2026-09-01",
    });
    assert.equal(parsed.months, 12);
    assert.equal(parsed.noticeDays, 30);
  });
});

describe("signContractSchema", () => {
  it("requires a 6-digit OTP and explicit acceptance", () => {
    assert.equal(
      signContractSchema.safeParse({
        token: "abc",
        typedName: "Maria",
        otp: "123456",
        accepted: true,
      }).success,
      true,
    );
    assert.equal(
      signContractSchema.safeParse({
        token: "abc",
        typedName: "Maria",
        otp: "12",
        accepted: true,
      }).success,
      false,
    );
    assert.equal(
      signContractSchema.safeParse({
        token: "abc",
        typedName: "Maria",
        otp: "123456",
        accepted: false,
      }).success,
      false,
    );
  });
});

describe("owner OTP API schemas", () => {
  it("accepts a trimmed email and a 6-digit code", () => {
    assert.equal(ownerOtpEmailSchema.safeParse({ email: "  maria@laro.pt " }).success, true);
    assert.equal(ownerOtpEmailSchema.safeParse({ email: "not-an-email" }).success, false);
    assert.equal(ownerOtpVerifySchema.safeParse({ email: "maria@laro.pt", otp: "123456" }).success, true);
    assert.equal(ownerOtpVerifySchema.safeParse({ email: "maria@laro.pt", otp: "12" }).success, false);
    assert.equal(ownerOtpVerifySchema.safeParse({ email: "maria@laro.pt", otp: "12345a" }).success, false);
  });
});

describe("companySchema and pulse schemas", () => {
  it("validates company email and pulse site address", () => {
    assert.equal(
      companySchema.safeParse({
        name: "Laro",
        nif: "123",
        address: "Porto",
        email: "ola@laro.pt",
        phone: "910000000",
      }).success,
      true,
    );
    assert.equal(
      pulseSiteSchema.safeParse({ ownerName: "A", address: "Rua longa 10" }).success,
      false,
    );
    assert.equal(
      pulseSiteSchema.safeParse({
        ownerName: "Maria Silva",
        email: "maria@laro.pt",
        address: "Rua longa 10",
      }).success,
      true,
    );
    assert.equal(
      pulseSiteSchema.safeParse({
        ownerName: "Maria Silva",
        address: "Rua longa 10",
      }).success,
      false,
    );
    assert.equal(
      pulseSiteSchema.safeParse({
        ownerName: "Maria Silva",
        email: "not-an-email",
        address: "Rua longa 10",
      }).success,
      false,
    );
    assert.equal(
      pulseReadingSchema.safeParse({ deviceId: "dev-1", leak: "true" }).success,
      true,
    );
    assert.equal(
      templateSaveSchema.safeParse({
        id: "t1",
        name: "Contrato",
        sections: [{ id: "s1", title: "Intro", body: "Olá" }],
      }).success,
      true,
    );
  });
});
