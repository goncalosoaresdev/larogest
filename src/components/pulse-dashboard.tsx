import Link from "next/link";
import type { IoTProvider, PulseAlert, PulseDevice, PulseDeviceKind } from "@prisma/client";
import type { IoTAdapterMeta, ProviderLocation } from "@/lib/iot/types";
import {
  BatteryLowIcon,
  DropletsIcon,
  HomeIcon,
  RadioIcon,
  RefreshCwIcon,
  ThermometerIcon,
  DoorClosedIcon,
  ActivityIcon,
  ScanIcon,
} from "lucide-react";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import {
  pulseAlertStatusLabel,
  pulseAlertTypeLabel,
  pulseDeviceKindLabel,
} from "@/lib/labels";
import {
  formatPulseHeadline,
  parsePulsePayload,
  isPulseSiteActive,
  pulseDeviceSeverity,
  pulseHouseHeadline,
  type PulseSeverity,
} from "@/lib/pulse";
import { PulseSiteControls } from "@/components/pulse-site-controls";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { FormField, NativeSelect } from "@/components/form-field";
import {
  ackPulseAlert,
  recordPulseReading,
  resolvePulseAlert,
  savePulseDeviceLink,
  linkPulseLocationByName,
  savePulseLocation,
  syncPulseLocation,
} from "@/app/(app)/pulse/actions";

const kindIcon: Record<PulseDeviceKind, typeof DropletsIcon> = {
  WATER: DropletsIcon,
  TEMP_HUMIDITY: ThermometerIcon,
  DOOR: DoorClosedIcon,
  MOTION: ScanIcon,
  GATEWAY: RadioIcon,
  OTHER: ActivityIcon,
};

const severityTile: Record<PulseSeverity, string> = {
  ok: "border-border/80",
  warn: "border-amber-500/40 bg-amber-500/5",
  alert: "border-destructive/50 bg-destructive/10",
  offline: "border-dashed border-border/70",
  idle: "border-border/60",
};

const severityDot: Record<PulseSeverity, string> = {
  ok: "bg-teal-400",
  warn: "bg-amber-400",
  alert: "bg-destructive",
  offline: "bg-muted-foreground/50",
  idle: "bg-muted-foreground/30",
};

const severityLabel: Record<PulseSeverity, string> = {
  ok: "Normal",
  warn: "Atenção",
  alert: "Alerta",
  offline: "Sem sinal",
  idle: "Por ler",
};

type PulseDashboardProps = {
  siteId: string;
  ownerName: string;
  address: string;
  provider: IoTProvider;
  locationId: string | null;
  locationName: string | null;
  providerMeta: IoTAdapterMeta;
  providers: IoTAdapterMeta[];
  locations: ProviderLocation[];
  suggestedLocation: ProviderLocation | null;
  locationHints: string[];
  leadHref: string | null;
  ownerHref: string;
  devices: PulseDevice[];
  alerts: PulseAlert[];
  siteStatus: string;
};

export function PulseDashboard({
  siteId,
  ownerName,
  address,
  provider,
  locationId,
  locationName,
  providerMeta,
  providers,
  locations,
  suggestedLocation,
  locationHints,
  leadHref,
  ownerHref,
  devices,
  alerts,
  siteStatus,
}: PulseDashboardProps) {
  const openAlerts = alerts.filter((alert) => alert.status === "OPEN");
  const headline = pulseHouseHeadline(devices, openAlerts.length);
  const online = devices.filter((device) => device.online).length;
  const lastSeen = devices
    .map((device) => device.lastSeenAt)
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const saveHome = savePulseLocation.bind(null, siteId);
  const syncHome = syncPulseLocation.bind(null, siteId);
  const linkByName = linkPulseLocationByName.bind(null, siteId);
  const active = isPulseSiteActive(siteStatus);

  return (
    <div className="space-y-6">
      <PageHeader
        title={address || "Imóvel"}
        description={`${ownerName} · ${active ? headline : "Pulse desactivado"}`}
        action={
          <div className="flex flex-col items-end gap-2">
            <p className="text-sm text-muted-foreground">
              {devices.length} sensor{devices.length === 1 ? "" : "es"}
              {devices.length ? ` · ${online} no ar` : ""}
              {" · "}
              última {formatRelativeTime(lastSeen) ?? "—"}
            </p>
            <div className="flex flex-wrap items-center justify-end gap-3">
              {leadHref ? (
                <Link href={leadHref} className="text-sm text-muted-foreground hover:text-foreground">
                  Lead
                </Link>
              ) : null}
              <Link href={ownerHref} className="text-sm text-muted-foreground hover:text-foreground">
                Página do proprietário
              </Link>
              <PulseSiteControls siteId={siteId} status={siteStatus} />
            </div>
          </div>
        }
      />

      {!active ? (
        <p className="text-sm text-muted-foreground">
          Esta casa não recebe eventos nem sincroniza. Podes activar outra vez ou remover o Pulse.
        </p>
      ) : null}

      {openAlerts.length > 0 ? (
        <Card className="py-0">
          <ul className="divide-y">
            {openAlerts.map((alert) => (
              <OpenAlertRow key={alert.id} alert={alert} />
            ))}
          </ul>
        </Card>
      ) : null}

      <CasaProviderBar
        provider={provider}
        locationId={locationId}
        locationName={locationName}
        providerMeta={providerMeta}
        providers={providers}
        locations={locations}
        suggestedLocation={suggestedLocation}
        locationHints={locationHints}
        saveHome={saveHome}
        syncHome={syncHome}
        linkByName={linkByName}
        canSync={active}
      />

      {devices.length === 0 ? (
        <EmptySensors hint={providerMeta.pairingHint} />
      ) : (
        <section className="grid gap-4 md:grid-cols-2">
          {devices.map((device) => (
            <DeviceTile key={device.id} device={device} deviceIdLabel={providerMeta.deviceIdLabel} />
          ))}
        </section>
      )}

      <AlertHistory alerts={alerts.filter((alert) => alert.status !== "OPEN")} />
    </div>
  );
}

function CasaProviderBar({
  provider,
  locationId,
  locationName,
  providerMeta,
  providers,
  locations,
  suggestedLocation,
  locationHints,
  saveHome,
  syncHome,
  linkByName,
  canSync,
}: {
  provider: IoTProvider;
  locationId: string | null;
  locationName: string | null;
  providerMeta: IoTAdapterMeta;
  providers: IoTAdapterMeta[];
  locations: ProviderLocation[];
  suggestedLocation: ProviderLocation | null;
  locationHints: string[];
  saveHome: (formData: FormData) => Promise<void>;
  syncHome: () => Promise<void>;
  linkByName: () => Promise<void>;
  canSync: boolean;
}) {
  if (!locationId) {
    return (
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Casa no fornecedor</CardTitle>
          <CardDescription>{providerMeta.locationHint}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          {locationHints.length ? (
            <p className="text-sm text-muted-foreground">
              Nomeia a casa na Smart Life como{" "}
              {locationHints.map((name, index) => (
                <span key={name}>
                  {index > 0 ? " ou " : null}
                  <span className="font-medium text-foreground">{name}</span>
                </span>
              ))}
              .
            </p>
          ) : null}
          {suggestedLocation ? (
            <form action={linkByName} className="flex flex-wrap items-center gap-3">
              <p className="text-sm">
                Encontrámos <span className="font-medium">{suggestedLocation.name}</span>
              </p>
              <Button type="submit">Ligar esta casa</Button>
            </form>
          ) : (
            <form action={linkByName}>
              <Button type="submit" variant="outline">
                Procurar na Smart Life
              </Button>
            </form>
          )}
          <form action={saveHome} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <ProviderFields provider={provider} providers={providers} />
            <div className="flex-1">
              {locations.length ? (
                <NativeSelect name="locationId" defaultValue={suggestedLocation?.id ?? ""}>
                  <option value="">Escolher casa na Smart Life</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </NativeSelect>
              ) : (
                <Input name="locationId" placeholder={providerMeta.locationLabel} className="font-mono" />
              )}
            </div>
            <Button type="submit" variant="outline">
              Ligar
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
        <p className="flex items-center gap-2 text-sm">
          <HomeIcon className="size-3.5 text-muted-foreground" />
          {providerMeta.label} · {locationName ?? locationId}
        </p>
        <div className="flex items-center gap-2">
          {canSync ? (
            <form action={syncHome}>
              <Button type="submit" variant="ghost" size="sm">
                <RefreshCwIcon className="size-3.5" />
                Sincronizar
              </Button>
            </form>
          ) : null}
          <details className="text-sm">
            <summary className="cursor-pointer list-none text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
              Alterar
            </summary>
            <form action={saveHome} className="mt-3 flex flex-wrap gap-2">
              <ProviderFields provider={provider} providers={providers} />
              {locations.length ? (
                <NativeSelect name="locationId" defaultValue={locationId} className="h-8 w-auto">
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </NativeSelect>
              ) : (
                <Input name="locationId" defaultValue={locationId} className="h-8 w-40 font-mono" />
              )}
              <Button type="submit" size="sm" variant="outline">
                Guardar
              </Button>
            </form>
          </details>
        </div>
      </CardContent>
    </Card>
  );
}

function ProviderFields({
  provider,
  providers,
}: {
  provider: IoTProvider;
  providers: IoTAdapterMeta[];
}) {
  if (providers.length <= 1) {
    return <input type="hidden" name="provider" value={provider} />;
  }

  return (
    <NativeSelect name="provider" defaultValue={provider} className="h-8 w-auto">
      {providers.map((item) => (
        <option key={item.id} value={item.id}>
          {item.label}
        </option>
      ))}
    </NativeSelect>
  );
}

function DeviceTile({ device, deviceIdLabel }: { device: PulseDevice; deviceIdLabel: string }) {
  const reading = parsePulsePayload(device.lastPayload);
  const severity = pulseDeviceSeverity(device);
  const Icon = kindIcon[device.kind];
  const relative = formatRelativeTime(device.lastSeenAt);
  const saveLink = savePulseDeviceLink.bind(null, device.id);

  return (
    <Card className={cn("flex flex-col", severityTile[severity])}>
      <CardContent className="flex flex-1 flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-full bg-background/40 text-muted-foreground">
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{device.label}</p>
            <p className="text-[11px] text-muted-foreground">{pulseDeviceKindLabel[device.kind]}</p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] tracking-wide text-muted-foreground uppercase">
          <span className={cn("size-1.5 rounded-full", severityDot[severity])} />
          {severityLabel[severity]}
        </span>
      </div>

      <div className="flex flex-1 flex-col justify-center py-5">
        <DeviceReading device={device} reading={reading} />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
          <span>{relative ? relative : "Ainda sem leitura"}</span>
          {device.kind !== "GATEWAY" ? <BatteryMeter pct={device.batteryPct} /> : null}
        </div>

        <details className="border-t border-border/50 pt-3">
          <summary className="cursor-pointer list-none text-[11px] text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
            Corrigir leitura
          </summary>
          <form action={recordPulseReading} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="deviceId" value={device.id} />
            {device.kind === "WATER" ? (
              <FormField label="Estado">
                <NativeSelect name="leak" defaultValue={reading.leak === true ? "true" : "false"}>
                  <option value="false">Seco</option>
                  <option value="true">Fuga</option>
                </NativeSelect>
              </FormField>
            ) : null}
            {device.kind === "DOOR" ? (
              <FormField label="Estado">
                <NativeSelect name="open" defaultValue={reading.open === true ? "true" : "false"}>
                  <option value="false">Fechada</option>
                  <option value="true">Aberta</option>
                </NativeSelect>
              </FormField>
            ) : null}
            {device.kind === "TEMP_HUMIDITY" ? (
              <>
                <FormField label="Temperatura (°C)">
                  <Input
                    name="temperature"
                    inputMode="decimal"
                    defaultValue={reading.temperature != null ? String(reading.temperature) : ""}
                  />
                </FormField>
                <FormField label="Humidade (%)">
                  <Input
                    name="humidity"
                    inputMode="decimal"
                    defaultValue={reading.humidity != null ? String(reading.humidity) : ""}
                  />
                </FormField>
              </>
            ) : null}
            {device.kind === "MOTION" ? (
              <>
                <FormField label="Movimento">
                  <NativeSelect name="motion" defaultValue={reading.motion === true ? "true" : "false"}>
                    <option value="false">Calmo</option>
                    <option value="true">Detectado</option>
                  </NativeSelect>
                </FormField>
                <FormField label="Luminosidade (lx)">
                  <Input
                    name="lux"
                    inputMode="decimal"
                    defaultValue={reading.lux != null ? String(reading.lux) : ""}
                  />
                </FormField>
              </>
            ) : null}
            <FormField label="Ligação">
              <NativeSelect name="online" defaultValue={device.online ? "true" : "false"}>
                <option value="true">Online</option>
                <option value="false">Offline</option>
              </NativeSelect>
            </FormField>
            {device.kind !== "GATEWAY" ? (
              <FormField label="Bateria (%)">
                <Input
                  name="batteryPct"
                  inputMode="numeric"
                  defaultValue={device.batteryPct != null ? String(device.batteryPct) : ""}
                />
              </FormField>
            ) : null}
            <div className="sm:col-span-2">
              <Button type="submit" size="sm" variant="outline">
                Guardar leitura
              </Button>
            </div>
          </form>
          <form action={saveLink} className="mt-3 flex gap-2">
            <Input
              name="providerDeviceId"
              defaultValue={device.providerDeviceId ?? ""}
              placeholder={deviceIdLabel}
              className="h-8 font-mono text-xs"
            />
            <Button type="submit" size="sm" variant="ghost">
              ID
            </Button>
          </form>
        </details>
      </div>
      </CardContent>
    </Card>
  );
}

function DeviceReading({
  device,
  reading,
}: {
  device: PulseDevice;
  reading: ReturnType<typeof parsePulsePayload>;
}) {
  if (device.kind === "TEMP_HUMIDITY" && (reading.temperature != null || reading.humidity != null)) {
    return (
      <div className="grid grid-cols-2 gap-6">
        <Metric value={reading.temperature} unit="°C" digits={1} />
        <Metric value={reading.humidity} unit="%" digits={0} />
      </div>
    );
  }

  if (device.kind === "MOTION" && (reading.motion != null || reading.lux != null)) {
    return (
      <div className="grid grid-cols-2 gap-6">
        <div>
          <p
            className={cn(
              "text-2xl font-semibold tracking-tight",
              reading.motion === true && "text-amber-500",
              reading.motion == null && "text-muted-foreground",
            )}
          >
            {reading.motion === true ? "Movimento" : reading.motion === false ? "Calmo" : "—"}
          </p>
        </div>
        <Metric value={reading.lux} unit="lx" digits={0} />
      </div>
    );
  }

  return (
    <p
      className={cn(
        "text-2xl font-semibold tracking-tight",
        pulseDeviceSeverity(device) === "alert" && "text-destructive",
        pulseDeviceSeverity(device) === "idle" && "text-muted-foreground",
      )}
    >
      {formatPulseHeadline(device)}
    </p>
  );
}

function Metric({ value, unit, digits }: { value: number | undefined; unit: string; digits: number }) {
  if (value == null) {
    return <p className="text-2xl font-semibold text-muted-foreground">—</p>;
  }
  return (
    <p className="text-2xl font-semibold tracking-tight tabular-nums">
      {value.toLocaleString("pt-PT", { maximumFractionDigits: digits })}
      <span className="ml-1 text-base font-normal text-muted-foreground">{unit}</span>
    </p>
  );
}

function BatteryMeter({ pct }: { pct: number | null }) {
  if (pct == null) return null;
  const low = pct < 20;
  return (
    <span className="flex items-center gap-2">
      {low ? <BatteryLowIcon className="size-3 text-destructive" /> : null}
      <span className="h-1 w-16 overflow-hidden rounded-full bg-muted">
        <span
          className={cn("block h-1 rounded-full", low ? "bg-destructive" : "bg-foreground/70")}
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </span>
      <span className="font-mono tabular-nums">{pct}%</span>
    </span>
  );
}

function OpenAlertRow({ alert }: { alert: PulseAlert }) {
  const ack = ackPulseAlert.bind(null, alert.id);
  const resolve = resolvePulseAlert.bind(null, alert.id);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-destructive">{pulseAlertTypeLabel[alert.type]}</p>
        <p className="text-xs text-muted-foreground">
          {alert.message} · {formatRelativeTime(alert.triggeredAt)}
        </p>
      </div>
      <div className="flex gap-2">
        <form action={ack}>
          <Button type="submit" size="sm" variant="outline">
            Visto
          </Button>
        </form>
        <form action={resolve}>
          <Button type="submit" size="sm" variant="ghost">
            Resolver
          </Button>
        </form>
      </div>
    </div>
  );
}

function AlertHistory({ alerts }: { alerts: PulseAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium">Histórico</h2>
      <Card className="py-0">
      <ul className="divide-y">
        {alerts.map((alert) => (
          <li
            key={alert.id}
            className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm"
          >
            <span className="text-muted-foreground">
              {pulseAlertTypeLabel[alert.type]}
              <span className="ml-2 text-xs">{pulseAlertStatusLabel[alert.status]}</span>
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">{formatDateTime(alert.triggeredAt)}</span>
          </li>
        ))}
      </ul>
      </Card>
    </section>
  );
}

function EmptySensors({ hint }: { hint: string }) {
  return (
    <Card>
      <p className="p-6 text-sm text-muted-foreground">{hint}</p>
    </Card>
  );
}
