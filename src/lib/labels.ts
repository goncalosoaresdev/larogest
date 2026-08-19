export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL_SENT",
  "NEGOTIATING",
  "WON",
  "CONTRACT_SENT",
  "SIGNED",
  "LOST",
] as const;

export const PIPELINE_COLUMNS = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL_SENT",
  "NEGOTIATING",
  "WON",
  "CONTRACT_SENT",
  "SIGNED",
] as const;

export const LEAD_GROUPS = [
  { id: "entrada", label: "Entrada", statuses: ["NEW", "CONTACTED"] },
  { id: "conversa", label: "Em conversa", statuses: ["QUALIFIED", "PROPOSAL_SENT", "NEGOTIATING"] },
  { id: "fecho", label: "Fecho", statuses: ["WON", "CONTRACT_SENT", "SIGNED"] },
] as const;

export const leadStatusLabel: Record<(typeof LEAD_STATUSES)[number], string> = {
  NEW: "Novo",
  CONTACTED: "Contactado",
  QUALIFIED: "Qualificado",
  PROPOSAL_SENT: "Proposta enviada",
  NEGOTIATING: "Em negociação",
  WON: "Ganho",
  CONTRACT_SENT: "Contrato enviado",
  SIGNED: "Assinado",
  LOST: "Perdido",
};

export const leadSourceLabel = {
  WEBSITE: "laro.pt",
  WHATSAPP: "WhatsApp",
  REFERRAL: "Referência",
  MANUAL: "Manual",
  OTHER: "Outro",
} as const;

export const leadServiceLabel = {
  SCHEDULED_VISITS: "Visitas programadas",
  AL_MANAGEMENT: "Gestão de AL",
} as const;

export const visitKindLabel = {
  KNOWLEDGE: "Visita de conhecimento",
  PROPERTY_CARE: "Visita programada",
  OPERATION: "Check-in / operação",
} as const;

export const visitStatusLabel = {
  SCHEDULED: "Agendada",
  DONE: "Feita",
  CANCELLED: "Cancelada",
} as const;

export const pulseSiteStatusLabel = {
  ACTIVE: "Activo",
  DISABLED: "Desactivado",
} as const;

export const pulseDeviceKindLabel = {
  GATEWAY: "Gateway",
  DOOR: "Porta / janela",
  TEMP_HUMIDITY: "Temperatura e humidade",
  WATER: "Fuga de água",
  MOTION: "Movimento e luz",
  OTHER: "Outro sensor",
} as const;

export const pulseAlertTypeLabel = {
  WATER_LEAK: "Fuga de água",
  DOOR_OPEN: "Porta ou janela aberta",
  TEMP_HIGH: "Temperatura alta",
  TEMP_LOW: "Temperatura baixa",
  HUMIDITY_HIGH: "Humidade alta",
  MOTION: "Movimento detectado",
  BATTERY: "Bateria fraca",
  OFFLINE: "Sensor offline",
} as const;

export const pulseAlertStatusLabel = {
  OPEN: "Aberto",
  ACKED: "Visto",
  RESOLVED: "Resolvido",
} as const;

export const personTypeLabel = {
  INDIVIDUAL: "Particular",
  COMPANY: "Empresa",
} as const;

export const typologyLabel = {
  APARTMENT: "Apartamento",
  HOUSE: "Moradia",
  VILLA: "Villa",
  STUDIO: "Estúdio",
  OTHER: "Outro",
} as const;

export const packageLabel = {
  FULL_MANAGEMENT: "Gestão completa",
  CO_HOST: "Co-host",
  SETUP: "Setup / lançamento",
} as const;

export const commissionBaseLabel = {
  GROSS: "Receita bruta",
  NET: "Receita líquida",
} as const;

export const proposalStatusLabel = {
  DRAFT: "Rascunho",
  SENT: "Enviada",
  VIEWED: "Aberta",
  ACCEPTED: "Aceite",
  REJECTED: "Recusada",
  EXPIRED: "Expirada",
  SUPERSEDED: "Substituída",
} as const;

export const contractStatusLabel = {
  DRAFT: "Rascunho",
  SENT: "Enviado",
  PARTIALLY_SIGNED: "Parcialmente assinado",
  SIGNED: "Assinado",
  CANCELLED: "Cancelado",
} as const;

export const signerRoleLabel = {
  COMPANY: "Laro",
  OWNER: "Proprietário",
} as const;

export const PLACEHOLDERS = [
  { key: "{{lead.service}}", hint: "Serviço (visitas ou gestão de AL)" },
  { key: "{{owner.name}}", hint: "Nome do proprietário" },
  { key: "{{owner.email}}", hint: "Email" },
  { key: "{{owner.phone}}", hint: "Telefone" },
  { key: "{{owner.nif}}", hint: "NIF" },
  { key: "{{owner.address}}", hint: "Morada do proprietário" },
  { key: "{{owner.companyName}}", hint: "Nome da empresa" },
  { key: "{{property.address}}", hint: "Morada do imóvel" },
  { key: "{{property.city}}", hint: "Cidade" },
  { key: "{{property.typology}}", hint: "Tipologia" },
  { key: "{{property.capacity}}", hint: "Capacidade" },
  { key: "{{property.rnal}}", hint: "N.º RNAL" },
  { key: "{{proposal.reference}}", hint: "Referência da proposta" },
  { key: "{{proposal.package}}", hint: "Pacote de serviços" },
  { key: "{{proposal.commissionPct}}", hint: "Comissão %" },
  { key: "{{proposal.commissionBase}}", hint: "Base da comissão" },
  { key: "{{proposal.validUntil}}", hint: "Validade" },
  { key: "{{proposal.included}}", hint: "Serviços incluídos" },
  { key: "{{proposal.extras}}", hint: "Serviços extra" },
  { key: "{{contract.reference}}", hint: "Referência do contrato" },
  { key: "{{contract.startsOn}}", hint: "Início" },
  { key: "{{contract.endsOn}}", hint: "Fim" },
  { key: "{{contract.noticeDays}}", hint: "Dias de pré-aviso" },
  { key: "{{company.name}}", hint: "Nome da Laro" },
  { key: "{{company.nif}}", hint: "NIF da Laro" },
  { key: "{{company.address}}", hint: "Morada da Laro" },
  { key: "{{company.email}}", hint: "Email da Laro" },
  { key: "{{company.phone}}", hint: "Telefone da Laro" },
  { key: "{{today}}", hint: "Data de hoje" },
] as const;

export type TemplateSection = {
  id: string;
  title: string;
  body: string;
};
