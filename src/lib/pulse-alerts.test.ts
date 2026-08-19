import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  pulseAlertLane,
  pulseAlertUrgency,
  pulseAlertWork,
  pulseWorkLaneLabel,
} from "./pulse-alerts";

describe("pulseAlertLane", () => {
  it("puts acked alerts in seen and leaks in now", () => {
    assert.equal(pulseAlertLane("WATER_LEAK", "ACKED"), "seen");
    assert.equal(pulseAlertLane("WATER_LEAK", "OPEN"), "now");
    assert.equal(pulseAlertLane("BATTERY", "OPEN"), "watch");
  });
});

describe("pulseAlertUrgency", () => {
  it("orders leak first and unknown last", () => {
    assert.equal(pulseAlertUrgency("WATER_LEAK"), 0);
    assert.equal(pulseAlertUrgency("OFFLINE"), 1);
    assert.equal(pulseAlertUrgency("BATTERY"), 2);
    assert.equal(pulseAlertUrgency("TEMP_HIGH"), 3);
    assert.equal(pulseAlertUrgency("TEMP_LOW"), 3);
    assert.equal(pulseAlertUrgency("HUMIDITY_HIGH"), 3);
    assert.equal(pulseAlertUrgency("MOTION"), 4);
  });
});

describe("pulseAlertWork", () => {
  it("returns Portuguese verbs for each alert type", () => {
    assert.deepEqual(pulseAlertWork("WATER_LEAK"), { verb: "Ir à casa", why: "Fuga de água" });
    assert.deepEqual(pulseAlertWork("MOTION"), { verb: "Confirmar", why: "Movimento" });
    assert.deepEqual(pulseAlertWork("DOOR_OPEN"), { verb: "Ver porta", why: "Porta ou janela aberta" });
  });
});

describe("pulseWorkLaneLabel", () => {
  it("labels the three work lanes", () => {
    assert.equal(pulseWorkLaneLabel.now, "Ir agora");
    assert.equal(pulseWorkLaneLabel.watch, "Atenção");
    assert.equal(pulseWorkLaneLabel.seen, "Já visto");
  });
});
