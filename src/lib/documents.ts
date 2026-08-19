import { Prisma } from "@prisma/client";
import {
  commissionBaseLabel,
  leadServiceLabel,
  packageLabel,
  typologyLabel,
  type TemplateSection,
} from "@/lib/labels";
import { formatDateLong, formatMoney, formatPercent, toNumber } from "@/lib/format";
import { mergeSections } from "@/lib/merge";

type Company = {
  name: string;
  nif: string;
  address: string;
  email: string;
  phone: string;
};

type Owner = {
  name: string;
  email: string | null;
  phone: string | null;
  nif: string | null;
  address: string | null;
  companyName: string | null;
};

type PropertyInfo = {
  address: string;
  city: string | null;
  typology: keyof typeof typologyLabel;
  capacity: number | null;
  rnal: string | null;
};

type Commercial = {
  reference: string;
  package: keyof typeof packageLabel;
  commissionPct: Prisma.Decimal | number | string;
  commissionBase: keyof typeof commissionBaseLabel;
  setupFee: Prisma.Decimal | number | string | null;
  photographyFee: Prisma.Decimal | number | string | null;
  reserveFundPct: Prisma.Decimal | number | string | null;
  includedServices: string;
  extraServices: string;
  validUntil: Date;
};

export function buildMergeContext(input: {
  owner: Owner;
  property: PropertyInfo;
  company: Company;
  proposal: Commercial;
  lead?: {
    service: keyof typeof leadServiceLabel;
  };
  contract?: {
    reference: string;
    startsOn: Date;
    endsOn: Date;
    noticeDays: number;
  };
}) {
  return {
    lead: {
      service: input.lead ? leadServiceLabel[input.lead.service] : "",
    },
    owner: {
      name: input.owner.name,
      email: input.owner.email ?? "",
      phone: input.owner.phone ?? "",
      nif: input.owner.nif ?? "",
      address: input.owner.address ?? "",
      companyName: input.owner.companyName ?? "",
    },
    property: {
      address: input.property.address,
      city: input.property.city ?? "",
      typology: typologyLabel[input.property.typology],
      capacity: input.property.capacity ?? "",
      rnal: input.property.rnal ?? "por licenciar",
    },
    proposal: {
      reference: input.proposal.reference,
      package: packageLabel[input.proposal.package],
      commissionPct: formatPercent(toNumber(input.proposal.commissionPct)),
      commissionBase: commissionBaseLabel[input.proposal.commissionBase],
      setupFee: input.proposal.setupFee ? formatMoney(toNumber(input.proposal.setupFee)) : "—",
      photographyFee: input.proposal.photographyFee
        ? formatMoney(toNumber(input.proposal.photographyFee))
        : "—",
      reserveFundPct: input.proposal.reserveFundPct
        ? formatPercent(toNumber(input.proposal.reserveFundPct))
        : "—",
      validUntil: formatDateLong(input.proposal.validUntil),
      included: input.proposal.includedServices || "Nada a acrescentar ao pacote-base.",
      extras: input.proposal.extraServices || "Nenhum extra adicional nesta proposta.",
    },
    contract: input.contract
      ? {
          reference: input.contract.reference,
          startsOn: formatDateLong(input.contract.startsOn),
          endsOn: formatDateLong(input.contract.endsOn),
          noticeDays: String(input.contract.noticeDays),
        }
      : {},
    company: input.company,
    today: formatDateLong(new Date()),
  };
}

export function snapshotDocument(input: {
  sections: TemplateSection[];
  context: ReturnType<typeof buildMergeContext>;
  templateId: string;
  templateVersion: number;
}) {
  return {
    templateId: input.templateId,
    templateVersion: input.templateVersion,
    mergedAt: new Date().toISOString(),
    context: input.context,
    sections: mergeSections(input.sections, input.context),
  };
}

export function sectionsFromSnapshot(snapshot: unknown): TemplateSection[] {
  if (!snapshot || typeof snapshot !== "object") return [];
  const sections = (snapshot as { sections?: TemplateSection[] }).sections;
  return Array.isArray(sections) ? sections : [];
}
