import { format, formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return format(date, "d MMM yyyy", { locale: pt });
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return format(date, "d MMM yyyy, HH:mm", { locale: pt });
}

export function formatRelativeTime(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  return formatDistanceToNow(date, { locale: pt, addSuffix: true });
}

export function formatDateLong(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return format(date, "d 'de' MMMM 'de' yyyy", { locale: pt });
}

export function formatMoney(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const amount = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export function formatPercent(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const amount = typeof value === "string" ? Number(value) : value;
  return `${amount.toLocaleString("pt-PT", { maximumFractionDigits: 2 })} %`;
}

export function toNumber(value: { toNumber?: () => number } | number | string | null | undefined) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof value.toNumber === "function") return value.toNumber();
  return Number(value);
}
