import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatDate,
  formatDateLong,
  formatDateTime,
  formatMoney,
  formatPercent,
  formatRelativeTime,
  toNumber,
} from "./format";

const noon = new Date(2026, 7, 19, 14, 5, 0);

describe("formatDate family", () => {
  it("returns an em dash for empty values", () => {
    assert.equal(formatDate(null), "—");
    assert.equal(formatDate(undefined), "—");
    assert.equal(formatDateTime(""), "—");
    assert.equal(formatDateLong(null), "—");
    assert.equal(formatRelativeTime(null), null);
  });

  it("formats a known local date in Portuguese", () => {
    const day = formatDate(noon);
    assert.match(day, /19/);
    assert.match(day, /2026/);
    assert.match(day.toLowerCase(), /ago/);

    const long = formatDateLong(noon);
    assert.match(long, /19 de agosto de 2026/);

    const stamped = formatDateTime(noon);
    assert.match(stamped, /14:05/);
  });

  it("formats ISO strings the same way as Date objects", () => {
    assert.equal(formatDate(noon.toISOString()), formatDate(noon));
  });
});

describe("formatMoney and formatPercent", () => {
  it("formats euros and percents, and dashes empty input", () => {
    const money = formatMoney(1250.5);
    assert.match(money, /1250,50/);
    assert.match(money, /€/);
    assert.equal(formatMoney(null), "—");
    assert.equal(formatMoney(""), "—");

    const percent = formatPercent(18);
    assert.match(percent, /18/);
    assert.match(percent, /%/);
    assert.equal(formatPercent(undefined), "—");
  });
});

describe("toNumber", () => {
  it("coerces decimals, strings, and nulls", () => {
    assert.equal(toNumber(12.5), 12.5);
    assert.equal(toNumber("3.25"), 3.25);
    assert.equal(toNumber(null), 0);
    assert.equal(toNumber({ toNumber: () => 9 }), 9);
  });
});
