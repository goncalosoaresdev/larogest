import type { PulseAlertType, PulseDeviceKind } from "@prisma/client";
import { format, formatDistanceToNow } from "date-fns";
import { enUS, pt } from "date-fns/locale";
import { parsePulsePayload, pulseDeviceSeverity } from "@/lib/pulse";

export type CasaLocale = "pt" | "en";

export const DEFAULT_CASA_LOCALE: CasaLocale = "pt";
export const CASA_LOCALE_KEY = "laro-casa-locale";

const LISTENERS = new Set<() => void>();

export function parseCasaLocale(value: unknown): CasaLocale {
  return value === "en" ? "en" : "pt";
}

export function switchCasaLocale(_current: CasaLocale, next: unknown): CasaLocale {
  return parseCasaLocale(next);
}

export function readCasaLocale(): CasaLocale {
  if (typeof window === "undefined") return DEFAULT_CASA_LOCALE;
  try {
    return parseCasaLocale(window.localStorage.getItem(CASA_LOCALE_KEY));
  } catch {
    return DEFAULT_CASA_LOCALE;
  }
}

export function writeCasaLocale(next: unknown): CasaLocale {
  const locale = parseCasaLocale(next);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(CASA_LOCALE_KEY, locale);
    } catch {
      // ignore quota / private mode
    }
    window.dispatchEvent(new Event("casa-locale"));
  }
  LISTENERS.forEach((listen) => listen());
  return locale;
}

export function subscribeCasaLocale(listen: () => void) {
  LISTENERS.add(listen);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", listen);
    window.addEventListener("casa-locale", listen);
  }
  return () => {
    LISTENERS.delete(listen);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", listen);
      window.removeEventListener("casa-locale", listen);
    }
  };
}

export type CasaTextKey = keyof typeof PT;

const PT = {
  "skip": "Saltar para o conteúdo",
  "login.title": "A sua casa, sempre por perto.",
  "login.headline1": "A sua casa,",
  "login.headline2": "sempre",
  "login.headline3": "por perto.",
  "login.secure": "Acesso seguro por código",
  "login.lead": "Use o email da casa. Enviamos um código de 6 dígitos.",
  "login.email": "Email",
  "login.emailPlaceholder": "Email da casa",
  "login.send": "Enviar código",
  "login.sending": "A enviar…",
  "login.sent": "Se este email estiver ligado a uma casa Pulse, o código já vai a caminho.",
  "login.code": "Código de 6 dígitos",
  "login.codeHint": "O código expira em {time}",
  "login.codeExpired": "O código expirou. Pede um novo.",
  "login.changeEmail": "Usar outro email",
  "login.verify": "Entrar",
  "login.verifying": "A entrar…",
  "login.invalidEmail": "Indica um email válido.",
  "login.invalidCode": "Código inválido ou expirado.",
  "login.rateLimit": "Demasiados pedidos. Tenta daqui a pouco.",
  "login.preview": "Modo local — código: {code}",
  "login.previewHint": "Modo local — o email ficou em storage/emails.",
  "house.yours": "A sua casa",
  "house.inCity": "Casa de {city}",
  "house.selected": "Casa selecionada: {name}",
  "house.choose": "Casa selecionada: {name}. Escolher outra casa",
  "house.close": "Fechar",
  "house.list": "Casas Pulse",
  "alerts.count.one": "1 alerta",
  "alerts.count.many": "{n} alertas",
  "alerts.none": "Alertas",
  "settings.aria": "Definições",
  "nav": "Navegação",
  "tab.home": "Casa",
  "tab.history": "Histórico",
  "tab.alerts": "Alertas",
  "hello.morning": "Bom dia,",
  "hello.afternoon": "Boa tarde,",
  "hello.evening": "Boa noite,",
  "home.state": "Estado da casa",
  "home.floorplan": "Planta da casa vista de cima",
  "hub.laroAlerted": "A Laro já foi avisada",
  "hub.laroWatching": "A Laro está a ver",
  "hub.offline": "Sem ligação",
  "hub.noReading": "Ainda sem leitura",
  "hub.watched": "Casa acompanhada",
  "chip.temp": "Temperatura",
  "chip.humidity": "Humidade",
  "chip.water": "Água",
  "chip.door": "Porta",
  "chip.presence": "Presença",
  "chip.room": "Sala",
  "chip.kitchen": "Cozinha",
  "chip.mainDoor": "Porta principal",
  "chip.leak": "Fuga",
  "chip.dry": "Seco",
  "chip.noLeak": "Sem fugas",
  "chip.open": "Aberta",
  "chip.closed": "Fechada",
  "chip.doorOpen": "Porta aberta",
  "chip.doorClosed": "Porta fechada",
  "chip.motion": "Movimento",
  "chip.still": "Calmo",
  "chip.noMotion": "Sem movimento",
  "chip.online": "Online",
  "status.alert": "Alerta ativo",
  "status.offline": "Sem sinal",
  "status.idle": "Ainda sem leitura",
  "status.lowBattery": "Bateria fraca",
  "status.attention": "Precisa de atenção",
  "status.houseSafe": "Casa protegida",
  "status.doorOpen": "Porta aberta",
  "status.allDry": "Tudo seco",
  "status.normal": "Leitura normal",
  "status.presence": "Presença na casa",
  "status.nobody": "Ninguém à vista",
  "status.inRange": "Dentro do normal",
  "battery.unknown": "Bateria desconhecida",
  "battery.weak": "Fraca",
  "battery.low": "Baixa",
  "battery.good": "Boa",
  "battery.full": "Cheia",
  "battery.aria": "Bateria a {n}%.",
  "ask.talk": "Falar com a Laro",
  "ask.kicker": "WhatsApp · Equipa Laro",
  "ask.title": "Fale connosco sobre a casa",
  "ask.hint": "O estado atual segue automaticamente com a mensagem.",
  "ask.message": "A sua mensagem",
  "ask.quick": "Sugestões rápidas",
  "ask.whatsapp": "Abre o WhatsApp para confirmar o envio",
  "ask.continue": "Continuar",
  "ask.close": "Fechar mensagem",
  "ask.state": "Estado",
  "ask.invite.alert": "A Laro já foi avisada",
  "ask.invite.warn": "Há um aviso nesta casa",
  "ask.invite.offline": "A casa está sem sinal",
  "ask.invite.idle": "A casa ainda não tem leituras",
  "ask.invite.ok": "Tudo em ordem por agora",
  "ask.s1.alert": "Há um alerta na casa. Podem ir ver?",
  "ask.s2.alert": "Já estão a tratar disto?",
  "ask.s1.warn": "Vi o aviso. O que se passa?",
  "ask.s2.warn": "Preciso que alguém vá à casa.",
  "ask.s1.offline": "A casa está sem sinal. Conseguem verificar?",
  "ask.s2.offline": "Quando volta a ligação?",
  "ask.s1.idle": "Quando começam as leituras?",
  "ask.s2.idle": "Os sensores já estão instalados?",
  "ask.s1.ok": "Está tudo bem em casa?",
  "ask.s2.ok": "Podem passar esta semana?",
  "history.title": "Histórico",
  "history.loading": "A carregar as leituras…",
  "history.lead": "As leituras da casa, da mais recente à mais antiga.",
  "history.emptySensors": "Quando os sensores falarem, o dia aparece aqui.",
  "history.filter": "Filtrar por sensor",
  "history.all": "Todos",
  "history.error": "Não deu para carregar o histórico.",
  "history.empty": "Ainda sem leituras nesta casa.",
  "history.end": "Chegou às primeiras leituras.",
  "history.today": "Hoje",
  "history.yesterday": "Ontem",
  "history.sensor": "Sensor",
  "history.leak": "Fuga",
  "history.dry": "Seco",
  "history.open": "Aberta",
  "history.closed": "Fechada",
  "history.motion": "Movimento",
  "history.calm": "Calmo",
  "history.offline": "Sem sinal",
  "history.battery": "Bateria {n}%",
  "history.reading": "Leitura",
  "alerts.emptyTitle": "Nada a reportar",
  "alerts.emptyLead": "Se algo mudar na casa, aparece aqui. A Laro recebe o mesmo aviso.",
  "alerts.title": "Ocorrências",
  "alerts.open": "Aberto",
  "alerts.resolved": "Resolvido",
  "settings.title": "Definições",
  "settings.lead": "Ligue ou desligue os avisos desta casa.",
  "settings.account": "Conta",
  "settings.signOut": "Sair",
  "settings.signingOut": "A sair…",
  "home.emptyTitle": "Ainda sem casas Pulse",
  "home.emptyLead": "Quando a Laro ligar uma casa a este email, aparece aqui.",
  "settings.loadError": "Não deu para carregar as definições.",
  "settings.notifications": "Notificações",
  "settings.ios": "No iPhone: partilhar → Adicionar ao ecrã inicial, abrir a Pulse, e depois ligar os avisos.",
  "settings.push": "Avisos",
  "settings.pushHint": "Uma notificação no telemóvel quando a casa precisa de si",
  "settings.quiet": "Horas quietas",
  "settings.dnd": "Não incomodar",
  "settings.dndHint": "Só movimento e fugas de água passam. Os outros avisos ficam em silêncio.",
  "settings.from": "Das",
  "settings.to": "Às",
  "settings.hour": "1 hora",
  "settings.hours": "{n} horas",
  "settings.language": "Idioma",
  "settings.languageHint": "Português ou English, nesta casa.",
  "settings.portuguese": "Português",
  "settings.english": "English",
  "today.title": "Hoje em casa",
  "today.one": "1 alerta nestas horas",
  "today.many": "{n} alertas nestas horas",
  "today.calm": "Calmo nestas horas · deslize para ver o dia",
  "today.earlier": "A ver mais cedo",
  "today.humidity": "humidade",
  "today.scrub": "Percorrer o dia da casa",
  "chart.resolved": "resolvida",
  "chart.open": "aberto",
  "chart.lastReading": "Última leitura",
  "chart.now": "Agora",
  "chart.offline": "sem sinal",
  "close.sensor": "Fechar detalhe do sensor",
  "push.ios": "Para avisos no ecrã de bloqueio: partilhar → Adicionar ao ecrã inicial, abrir a Laro Pulse, e depois activar os avisos.",
  "push.denied": "Os avisos estão bloqueados neste browser.",
  "push.enable": "Activar avisos no telemóvel",
  "push.unavailable": "Indisponível.",
  "push.insecure": "Os avisos não funcionam neste endereço ({host}). Abra http://localhost:3001 ou use HTTPS.",
  "push.unsupported": "Este browser não suporta avisos no ecrã de bloqueio.",
  "push.unconfigured": "O servidor de avisos não está configurado.",
  "push.vapid": "Falta a chave VAPID no servidor.",
  "push.permission": "É preciso autorizar as notificações no browser.",
  "push.save": "Não deu para guardar a subscrição.",
  "push.brave": "O Brave bloqueia o serviço de avisos do Google. Em brave://settings/privacy, ligue «Use Google services for push messaging».",
  "push.http": "O Chrome bloqueia avisos em http://{host}. Abra http://localhost:3001 ou HTTPS.",
  "push.failed": "O serviço de avisos do browser falhou. Tente outro browser (Chrome ou Safari), desligue a VPN, ou limpe os dados deste site.",
  "headline.leak": "Fuga de água",
  "headline.motion": "Movimento detectado",
  "headline.alertOne": "1 alerta aberto",
  "headline.alerts": "{n} alertas abertos",
  "headline.offlineOne": "1 sensor sem sinal",
  "headline.offline": "{n} sensores sem sinal",
  "headline.waiting": "À espera dos sensores",
  "headline.noReading": "Ainda sem leitura",
  "headline.calm": "Tudo em ordem",
  "alert.WATER_LEAK": "Fuga de água",
  "alert.DOOR_OPEN": "Porta ou janela aberta",
  "alert.TEMP_HIGH": "Temperatura alta",
  "alert.TEMP_LOW": "Temperatura baixa",
  "alert.HUMIDITY_HIGH": "Humidade alta",
  "alert.MOTION": "Movimento detectado",
  "alert.BATTERY": "Bateria fraca",
  "alert.OFFLINE": "Sensor offline",
} as const;

const EN: Record<CasaTextKey, string> = {
  "skip": "Skip to content",
  "login.title": "Your house, always nearby.",
  "login.headline1": "Your house,",
  "login.headline2": "always",
  "login.headline3": "nearby.",
  "login.secure": "Secure access by code",
  "login.lead": "Use the house email. We'll send a 6-digit code.",
  "login.email": "Email",
  "login.emailPlaceholder": "House email",
  "login.send": "Send code",
  "login.sending": "Sending…",
  "login.sent": "If this email is linked to a Pulse house, the code is on its way.",
  "login.code": "6-digit code",
  "login.codeHint": "The code expires in {time}",
  "login.codeExpired": "The code expired. Request a new one.",
  "login.changeEmail": "Use another email",
  "login.verify": "Sign in",
  "login.verifying": "Signing in…",
  "login.invalidEmail": "Enter a valid email.",
  "login.invalidCode": "Invalid or expired code.",
  "login.rateLimit": "Too many attempts. Try again in a few minutes.",
  "login.preview": "Local mode — code: {code}",
  "login.previewHint": "Local mode — the email was written to storage/emails.",
  "house.yours": "Your house",
  "house.inCity": "House in {city}",
  "house.selected": "Selected house: {name}",
  "house.choose": "Selected house: {name}. Choose another house",
  "house.close": "Close",
  "house.list": "Pulse houses",
  "alerts.count.one": "1 alert",
  "alerts.count.many": "{n} alerts",
  "alerts.none": "Alerts",
  "settings.aria": "Settings",
  "nav": "Navigation",
  "tab.home": "Home",
  "tab.history": "History",
  "tab.alerts": "Alerts",
  "hello.morning": "Good morning,",
  "hello.afternoon": "Good afternoon,",
  "hello.evening": "Good evening,",
  "home.state": "House status",
  "home.floorplan": "Top-down house floorplan",
  "hub.laroAlerted": "Laro has already been notified",
  "hub.laroWatching": "Laro is looking at this",
  "hub.offline": "No connection",
  "hub.noReading": "No reading yet",
  "hub.watched": "House is being watched",
  "chip.temp": "Temperature",
  "chip.humidity": "Humidity",
  "chip.water": "Water",
  "chip.door": "Door",
  "chip.presence": "Presence",
  "chip.room": "Living room",
  "chip.kitchen": "Kitchen",
  "chip.mainDoor": "Front door",
  "chip.leak": "Leak",
  "chip.dry": "Dry",
  "chip.noLeak": "No leak",
  "chip.open": "Open",
  "chip.closed": "Closed",
  "chip.doorOpen": "Door open",
  "chip.doorClosed": "Door closed",
  "chip.motion": "Motion",
  "chip.still": "Quiet",
  "chip.noMotion": "No motion",
  "chip.online": "Online",
  "status.alert": "Active alert",
  "status.offline": "No signal",
  "status.idle": "No reading yet",
  "status.lowBattery": "Low battery",
  "status.attention": "Needs attention",
  "status.houseSafe": "House is secure",
  "status.doorOpen": "Door open",
  "status.allDry": "All dry",
  "status.normal": "Normal reading",
  "status.presence": "Someone in the house",
  "status.nobody": "Nobody in sight",
  "status.inRange": "Within range",
  "battery.unknown": "Battery unknown",
  "battery.weak": "Weak",
  "battery.low": "Low",
  "battery.good": "Good",
  "battery.full": "Full",
  "battery.aria": "Battery at {n}%.",
  "ask.talk": "Talk to Laro",
  "ask.kicker": "WhatsApp · Laro team",
  "ask.title": "Write to us about the house",
  "ask.hint": "The current status is added to the message automatically.",
  "ask.message": "Your message",
  "ask.quick": "Quick suggestions",
  "ask.whatsapp": "Opens WhatsApp so you can confirm sending",
  "ask.continue": "Continue",
  "ask.close": "Close message",
  "ask.state": "Status",
  "ask.invite.alert": "Laro has already been notified",
  "ask.invite.warn": "There is an alert in this house",
  "ask.invite.offline": "The house is offline",
  "ask.invite.idle": "The house has no readings yet",
  "ask.invite.ok": "Everything looks fine for now",
  "ask.s1.alert": "There is an alert at the house. Can you go check?",
  "ask.s2.alert": "Are you already on this?",
  "ask.s1.warn": "I saw the alert. What is going on?",
  "ask.s2.warn": "I need someone to go to the house.",
  "ask.s1.offline": "The house is offline. Can you check?",
  "ask.s2.offline": "When will the connection come back?",
  "ask.s1.idle": "When do the readings start?",
  "ask.s2.idle": "Are the sensors installed yet?",
  "ask.s1.ok": "Is everything alright at the house?",
  "ask.s2.ok": "Can you stop by this week?",
  "history.title": "History",
  "history.loading": "Loading readings…",
  "history.lead": "House readings, newest first.",
  "history.emptySensors": "When the sensors speak, the day shows up here.",
  "history.filter": "Filter by sensor",
  "history.all": "All",
  "history.error": "Could not load the history.",
  "history.empty": "No readings in this house yet.",
  "history.end": "You reached the first readings.",
  "history.today": "Today",
  "history.yesterday": "Yesterday",
  "history.sensor": "Sensor",
  "history.leak": "Leak",
  "history.dry": "Dry",
  "history.open": "Open",
  "history.closed": "Closed",
  "history.motion": "Motion",
  "history.calm": "Quiet",
  "history.offline": "No signal",
  "history.battery": "Battery {n}%",
  "history.reading": "Reading",
  "alerts.emptyTitle": "Nothing to report",
  "alerts.emptyLead": "If something changes in the house, it appears here. Laro gets the same alert.",
  "alerts.title": "Events",
  "alerts.open": "Open",
  "alerts.resolved": "Resolved",
  "settings.title": "Settings",
  "settings.lead": "Turn this house’s alerts on or off.",
  "settings.account": "Account",
  "settings.signOut": "Sign out",
  "settings.signingOut": "Signing out…",
  "home.emptyTitle": "No Pulse houses yet",
  "home.emptyLead": "When Laro links a house to this email, it will show up here.",
  "settings.loadError": "Could not load the settings.",
  "settings.notifications": "Notifications",
  "settings.ios": "On iPhone: share → Add to Home Screen, open Pulse, then turn alerts on.",
  "settings.push": "Alerts",
  "settings.pushHint": "A phone notification when the house needs you",
  "settings.quiet": "Quiet hours",
  "settings.dnd": "Do not disturb",
  "settings.dndHint": "Only motion and water leaks get through. Other alerts stay silent.",
  "settings.from": "From",
  "settings.to": "To",
  "settings.hour": "1 hour",
  "settings.hours": "{n} hours",
  "settings.language": "Language",
  "settings.languageHint": "Portuguese or English, for this house.",
  "settings.portuguese": "Português",
  "settings.english": "English",
  "today.title": "Today at home",
  "today.one": "1 alert in this window",
  "today.many": "{n} alerts in this window",
  "today.calm": "Quiet in these hours · slide to see the day",
  "today.earlier": "Looking earlier",
  "today.humidity": "humidity",
  "today.scrub": "Browse the house’s day",
  "chart.resolved": "resolved",
  "chart.open": "open",
  "chart.lastReading": "Last reading",
  "chart.now": "Now",
  "chart.offline": "no signal",
  "close.sensor": "Close sensor detail",
  "push.ios": "For lock-screen alerts: share → Add to Home Screen, open Laro Pulse, then enable alerts.",
  "push.denied": "Alerts are blocked in this browser.",
  "push.enable": "Enable phone alerts",
  "push.unavailable": "Unavailable.",
  "push.insecure": "Alerts do not work at this address ({host}). Open http://localhost:3001 or use HTTPS.",
  "push.unsupported": "This browser does not support lock-screen alerts.",
  "push.unconfigured": "The alert server is not configured.",
  "push.vapid": "The server is missing the VAPID key.",
  "push.permission": "You need to allow notifications in the browser.",
  "push.save": "Could not save the subscription.",
  "push.brave": "Brave blocks Google’s push service. In brave://settings/privacy, turn on “Use Google services for push messaging”.",
  "push.http": "Chrome blocks alerts on http://{host}. Open http://localhost:3001 or HTTPS.",
  "push.failed": "The browser push service failed. Try another browser (Chrome or Safari), turn off the VPN, or clear this site’s data.",
  "headline.leak": "Water leak",
  "headline.motion": "Motion detected",
  "headline.alertOne": "1 open alert",
  "headline.alerts": "{n} open alerts",
  "headline.offlineOne": "1 sensor offline",
  "headline.offline": "{n} sensors offline",
  "headline.waiting": "Waiting for sensors",
  "headline.noReading": "No reading yet",
  "headline.calm": "All in order",
  "alert.WATER_LEAK": "Water leak",
  "alert.DOOR_OPEN": "Door or window open",
  "alert.TEMP_HIGH": "High temperature",
  "alert.TEMP_LOW": "Low temperature",
  "alert.HUMIDITY_HIGH": "High humidity",
  "alert.MOTION": "Motion detected",
  "alert.BATTERY": "Low battery",
  "alert.OFFLINE": "Sensor offline",
};

const TABLES: Record<CasaLocale, Record<CasaTextKey, string>> = { pt: PT, en: EN };

export function casaText(locale: CasaLocale, key: CasaTextKey, vars?: Record<string, string | number>) {
  const table = TABLES[parseCasaLocale(locale)] ?? TABLES.pt;
  let text = table[key] ?? TABLES.pt[key] ?? String(key);
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

export function casaAlertTypeLabel(locale: CasaLocale, type: PulseAlertType) {
  const key = `alert.${type}` as CasaTextKey;
  return casaText(locale, key);
}

export type CasaHeadlineKind = "leak" | "motion" | "alerts" | "offline" | "waiting" | "noReading" | "calm";

export function casaHeadlineKind(
  devices: Array<{
    kind: PulseDeviceKind;
    online: boolean;
    lastSeenAt: Date | string | null;
    batteryPct: number | null;
    reading?: import("@/lib/pulse").PulseReading;
    lastPayload?: unknown;
  }>,
  openAlertCount: number,
): { id: CasaHeadlineKind; n?: number } {
  if (devices.some((device) => pulseDeviceSeverity(device) === "alert")) return { id: "leak" };
  if (devices.some((device) => device.kind === "MOTION" && (device.reading ?? parsePulsePayload(device.lastPayload)).motion === true)) {
    return { id: "motion" };
  }
  if (openAlertCount === 1) return { id: "alerts", n: 1 };
  if (openAlertCount > 1) return { id: "alerts", n: openAlertCount };
  const silent = devices.filter((device) => !device.online && device.lastSeenAt).length;
  if (silent === 1) return { id: "offline", n: 1 };
  if (silent > 1) return { id: "offline", n: silent };
  if (devices.length === 0) return { id: "waiting" };
  if (devices.every((device) => !device.lastSeenAt)) return { id: "noReading" };
  return { id: "calm" };
}

export function casaHeadline(
  locale: CasaLocale,
  devices: Parameters<typeof casaHeadlineKind>[0],
  openAlertCount: number,
) {
  const kind = casaHeadlineKind(devices, openAlertCount);
  if (kind.id === "alerts") {
    return kind.n === 1 ? casaText(locale, "headline.alertOne") : casaText(locale, "headline.alerts", { n: kind.n ?? 0 });
  }
  if (kind.id === "offline") {
    return kind.n === 1 ? casaText(locale, "headline.offlineOne") : casaText(locale, "headline.offline", { n: kind.n ?? 0 });
  }
  if (kind.id === "leak") return casaText(locale, "headline.leak");
  if (kind.id === "motion") return casaText(locale, "headline.motion");
  if (kind.id === "waiting") return casaText(locale, "headline.waiting");
  if (kind.id === "noReading") return casaText(locale, "headline.noReading");
  return casaText(locale, "headline.calm");
}

export function casaHouseTitle(locale: CasaLocale, city: string | null, address: string) {
  if (city) return casaText(locale, "house.inCity", { city });
  return address || casaText(locale, "house.yours");
}

export function casaDateLocale(locale: CasaLocale) {
  return locale === "en" ? "en-GB" : "pt-PT";
}

export function casaFnsLocale(locale: CasaLocale) {
  return locale === "en" ? enUS : pt;
}

export function casaRelativeTime(value: Date | string | null | undefined, locale: CasaLocale) {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  return formatDistanceToNow(date, { locale: casaFnsLocale(locale), addSuffix: true });
}

export function casaHistoryDay(at: Date, now: Date, locale: CasaLocale) {
  if (at.toDateString() === now.toDateString()) return casaText(locale, "history.today");
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (at.toDateString() === yesterday.toDateString()) return casaText(locale, "history.yesterday");
  return format(at, "EEEE, d MMM", { locale: casaFnsLocale(locale) });
}

export function isPushErrorKey(value: string): value is CasaTextKey {
  return value.startsWith("push.") && value in PT;
}
