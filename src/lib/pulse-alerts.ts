import type { PulseAlertType } from "@prisma/client";

export type PulseWorkLane = "now" | "watch" | "seen";

export function pulseAlertLane(type: PulseAlertType, status: string): PulseWorkLane {
  if (status === "ACKED") return "seen";
  if (type === "WATER_LEAK") return "now";
  return "watch";
}

export function pulseAlertUrgency(type: PulseAlertType): number {
  switch (type) {
    case "WATER_LEAK":
      return 0;
    case "OFFLINE":
      return 1;
    case "BATTERY":
      return 2;
    case "TEMP_HIGH":
    case "TEMP_LOW":
    case "HUMIDITY_HIGH":
      return 3;
    default:
      return 4;
  }
}

export function pulseAlertWork(type: PulseAlertType) {
  switch (type) {
    case "WATER_LEAK":
      return { verb: "Ir à casa", why: "Fuga de água" };
    case "OFFLINE":
      return { verb: "Verificar sensor", why: "Sem sinal" };
    case "BATTERY":
      return { verb: "Trocar bateria", why: "Bateria fraca" };
    case "TEMP_HIGH":
      return { verb: "Ver clima", why: "Temperatura alta" };
    case "TEMP_LOW":
      return { verb: "Ver clima", why: "Temperatura baixa" };
    case "HUMIDITY_HIGH":
      return { verb: "Ver humidade", why: "Humidade alta" };
    case "MOTION":
      return { verb: "Confirmar", why: "Movimento" };
    case "DOOR_OPEN":
      return { verb: "Ver porta", why: "Porta ou janela aberta" };
  }
}

export const pulseWorkLaneLabel: Record<PulseWorkLane, string> = {
  now: "Ir agora",
  watch: "Atenção",
  seen: "Já visto",
};
