import { IoTProvider } from "@prisma/client";
import { z } from "zod";

export const leadFormSchema = z.object({
  name: z.string().min(2, "Indica o nome"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  nif: z.string().optional(),
  ownerAddress: z.string().optional(),
  personType: z.enum(["INDIVIDUAL", "COMPANY"]),
  companyName: z.string().optional(),
  source: z.enum(["WEBSITE", "WHATSAPP", "REFERRAL", "MANUAL", "OTHER"]),
  service: z.enum(["SCHEDULED_VISITS", "AL_MANAGEMENT"]),
  address: z.string().min(3, "Indica a morada ou zona do imóvel"),
  city: z.string().optional(),
  typology: z.enum(["APARTMENT", "HOUSE", "VILLA", "STUDIO", "OTHER"]),
  capacity: z.coerce.number().int().positive().optional().or(z.nan()),
  rnal: z.string().optional(),
  notes: z.string().optional(),
});

export const leadStatusSchema = z.object({
  status: z.enum([
    "NEW",
    "CONTACTED",
    "QUALIFIED",
    "PROPOSAL_SENT",
    "NEGOTIATING",
    "WON",
    "CONTRACT_SENT",
    "SIGNED",
    "LOST",
  ]),
  lostReason: z.string().optional(),
});

export const visitFormSchema = z.object({
  leadId: z.string(),
  kind: z.enum(["KNOWLEDGE", "PROPERTY_CARE", "OPERATION"]),
  scheduledAt: z.string().min(1, "Indica a data e hora"),
  notes: z.string().optional(),
});

export const pulseSiteSchema = z.object({
  ownerName: z.string().min(2, "Indica o proprietário"),
  address: z.string().min(3, "Indica a morada"),
  city: z.string().optional(),
});

export const pulseLocationSchema = z.object({
  provider: z.enum(IoTProvider),
  locationId: z.string().optional(),
});

export const pulseReadingSchema = z.object({
  deviceId: z.string().min(1),
  online: z.enum(["true", "false"]).optional(),
  batteryPct: z.string().optional(),
  open: z.enum(["true", "false"]).optional(),
  leak: z.enum(["true", "false"]).optional(),
  motion: z.enum(["true", "false"]).optional(),
  temperature: z.string().optional(),
  humidity: z.string().optional(),
  lux: z.string().optional(),
});

export const proposalFormSchema = z.object({
  leadId: z.string(),
  package: z.enum(["FULL_MANAGEMENT", "CO_HOST", "SETUP"]),
  commissionPct: z.coerce.number().min(0).max(100),
  commissionBase: z.enum(["GROSS", "NET"]),
  includedServices: z.string().optional(),
  extraServices: z.string().optional(),
  validDays: z.coerce.number().int().min(1).max(90).default(14),
});

export const contractFormSchema = z.object({
  proposalId: z.string(),
  startsOn: z.string().min(1),
  months: z.coerce.number().int().min(1).max(60).default(12),
  noticeDays: z.coerce.number().int().min(0).max(180).default(30),
});

export const templateSectionSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  body: z.string(),
});

export const templateSaveSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  sections: z.array(templateSectionSchema).min(1),
});

export const companySchema = z.object({
  name: z.string().min(1),
  nif: z.string().min(1),
  address: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  website: z.string().optional(),
});

export const signContractSchema = z.object({
  token: z.string(),
  typedName: z.string().min(2, "Escreve o teu nome"),
  otp: z.string().length(6, "Código de 6 dígitos"),
  accepted: z.literal(true, { error: "Tens de aceitar o contrato" }),
});
