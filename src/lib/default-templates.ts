import { newSection } from "@/lib/merge";
import type { TemplateSection } from "@/lib/labels";

export const defaultProposalSections: TemplateSection[] = [
  {
    ...newSection("O imóvel"),
    body: `Serviço: {{lead.service}}
Imóvel: {{property.address}}, {{property.city}}
Tipologia: {{property.typology}} · Capacidade: {{property.capacity}}
RNAL: {{property.rnal}}
Válida até {{proposal.validUntil}}`,
  },
  {
    ...newSection("Enquadramento"),
    body: `A Laro propõe-se a acompanhar a operação do alojamento em {{property.city}}, com uma gestão próxima e local no Centro de Portugal.

Esta proposta descreve o âmbito do serviço, as condições comerciais e o que fica de fora. Não constitui garantia de ocupação, de receita ou de classificação nas plataformas.

O alinhamento é simples: a remuneração da Laro está associada ao desempenho da propriedade — só existe comissão quando existem estadias.`,
  },
  {
    ...newSection("Serviços incluídos"),
    body: `Pacote proposto: {{proposal.package}}

A Laro ficará responsável pelo acompanhamento da operação do alojamento, incluindo:

Preparação e presença nas plataformas
• Apoio na preparação operacional do alojamento para o início da atividade
• Sessão fotográfica e preparação visual do alojamento
• Criação, configuração e otimização dos anúncios nas principais plataformas, nomeadamente Airbnb e Booking.com

Reservas, preços e hóspedes
• Gestão das reservas e calendários
• Gestão e otimização dos preços
• Comunicação com os hóspedes antes, durante e após a estadia
• Coordenação de check-in e check-out, autónomo ou presencial, conforme a necessidade
• Organização de welcome kit de boas-vindas

Imóvel e operação no terreno
• Coordenação da limpeza, lavandaria e preparação do imóvel entre estadias
• Verificação do alojamento após as estadias
• Acompanhamento regular do estado geral da propriedade
• Coordenação de pequenas manutenções e resolução de ocorrências
• Articulação com profissionais externos sempre que seja necessária alguma intervenção

Reporting e obrigações
• Relatório mensal de ocupação e receitas
• Apoio operacional nas comunicações obrigatórias relativas aos hóspedes, quando aplicável

Notas específicas deste imóvel:
{{proposal.included}}`,
  },
  {
    ...newSection("Condições comerciais"),
    body: `Comissão de gestão: {{proposal.commissionPct}} sobre {{proposal.commissionBase}}

A Laro receberá uma comissão correspondente a {{proposal.commissionPct}} sobre a receita das noites efetivamente realizadas ({{proposal.commissionBase}}).

A comissão não incide sobre:
• Taxa de limpeza
• Cauções
• Taxas e impostos
• Indemnizações ou valores relativos a danos
• Outros encargos cobrados separadamente ao hóspede

A taxa de limpeza será cobrada ao hóspede através das plataformas de reserva e será definida de acordo com o custo necessário para assegurar a limpeza e preparação adequada do alojamento.

As receitas provenientes das reservas serão recebidas diretamente pelo proprietário através das respetivas plataformas.

A comissão de gestão será faturada mensalmente, acrescida de IVA à taxa legal em vigor, quando aplicável.`,
  },
  {
    ...newSection("Custos não incluídos"),
    body: `Não estão incluídos na comissão de gestão:
• Limpezas profundas ou extraordinárias
• Reparações e intervenções de manutenção
• Materiais, peças ou equipamentos
• Substituição de mobiliário ou eletrodomésticos
• Consumíveis e reposições extraordinárias
• Serviços prestados por profissionais externos
• Seguros associados ao imóvel e à atividade
• Taxas, impostos e restantes encargos da responsabilidade do proprietário

Sempre que seja necessária uma intervenção com custos adicionais, o proprietário será previamente informado para aprovação, salvo situações urgentes em que seja necessária uma atuação imediata para evitar danos no imóvel ou proteger os hóspedes.

Outros extras desta proposta:
{{proposal.extras}}`,
  },
  {
    ...newSection("Do lado do proprietário"),
    body: `Fica a cargo do proprietário, salvo acordo escrito em contrário:
• Titularidade e manutenção da licença RNAL ({{property.rnal}})
• Contratos de eletricidade, água, gás, internet e condomínio
• Seguro de responsabilidade civil do Alojamento Local e demais seguros do imóvel
• Acesso ao imóvel, chaves e códigos, e informação necessária à operação
• Aprovação de despesas extraordinárias, nos termos desta proposta

Uso pessoal: o proprietário pode reservar o imóvel para uso próprio, com aviso prévio suficiente para não afetar reservas já confirmadas. Datas bloqueadas não geram comissão.`,
  },
  {
    ...newSection("Duração"),
    body: `A prestação do serviço terá uma duração inicial de 12 meses, renovável.

Qualquer uma das partes poderá terminar o contrato mediante comunicação escrita com 30 dias de antecedência.`,
  },
  {
    ...newSection("Próximos passos"),
    body: `Esta proposta é válida até {{proposal.validUntil}}.

Caso esteja de acordo, será preparado o respectivo contrato de prestação de serviços para análise e assinatura.

Após a formalização do contrato e estando o Alojamento Local em condições de iniciar atividade, avançaremos.

Aceitar esta proposta não substitui o contrato. Os termos comerciais aqui descritos serão formalizados no contrato de gestão {{company.name}}.

O nosso objetivo é proporcionar uma gestão próxima e cuidada, permitindo que o proprietário tenha tranquilidade enquanto a Laro acompanha toda a operação diária do alojamento.

Ficamos disponíveis para esclarecer qualquer questão ou ajustar algum ponto.`,
  },
];

export const defaultContractSections: TemplateSection[] = [
  {
    ...newSection("Identificação das partes"),
    body: `Primeira contraente (gestora): {{company.name}}, NIF {{company.nif}}, com sede em {{company.address}}, email {{company.email}}.

Segunda contraente (proprietário): {{owner.name}}, NIF {{owner.nif}}, morada {{owner.address}}, email {{owner.email}}, telefone {{owner.phone}}.
{{owner.companyName}}

[O advogado confirma a qualidade jurídica de cada parte e a representação, se aplicável.]`,
  },
  {
    ...newSection("Objecto"),
    body: `[A preencher pelo advogado: prestação de serviços de gestão de Alojamento Local ou cessão de exploração. Esta escolha determina forma e assinatura.]

Imóvel: {{property.address}}, {{property.city}}.
Tipologia: {{property.typology}}. Capacidade: {{property.capacity}}.
Licença RNAL: {{property.rnal}}.`,
  },
  {
    ...newSection("Exclusividade"),
    body: `[A preencher pelo advogado: exclusividade de anúncio e exploração durante a vigência, e regras de uso pessoal do proprietário.]`,
  },
  {
    ...newSection("Comissão e base de cálculo"),
    body: `Comissão: {{proposal.commissionPct}} sobre {{proposal.commissionBase}}, conforme proposta {{proposal.reference}}.

Serviços incluídos:
{{proposal.included}}

Serviços extra:
{{proposal.extras}}

[A preencher pelo advogado/contabilista: IVA, comissões de plataformas, e o que entra ou sai da base.]`,
  },
  {
    ...newSection("Repasse e conta-corrente"),
    body: `[A preencher pelo advogado: dia de repasse, conta-corrente, prazo para impugnação do apuramento mensal.]`,
  },
  {
    ...newSection("Despesas extraordinárias"),
    body: `[A preencher pelo advogado: tecto de despesas sem autorização prévia, manutenção vs. operação, limpezas extraordinárias.]`,
  },
  {
    ...newSection("Uso pessoal do proprietário"),
    body: `[A preencher pelo advogado: prazo de aviso para bloqueio de datas e impacto na ocupação.]`,
  },
  {
    ...newSection("Seguros e responsabilidade"),
    body: `[A preencher pelo advogado: seguro de responsabilidade civil obrigatório do AL, danos, franquias.]`,
  },
  {
    ...newSection("Obrigações fiscais e legais"),
    body: `[A preencher pelo advogado: quem detém o RNAL, quem fatura, Modelo 30, SIBA/AIMA, INE e taxa turística. A Laro não substitui a Autoridade Tributária nem o SIBA.]`,
  },
  {
    ...newSection("Duração, renovação e denúncia"),
    body: `Início: {{contract.startsOn}}.
Fim: {{contract.endsOn}}.
Pré-aviso: {{contract.noticeDays}} dias.

[A preencher pelo advogado: renovação automática, rescisão por incumprimento, e eventuais indemnizações.]`,
  },
  {
    ...newSection("Proteção de dados"),
    body: `[A preencher pelo advogado: RGPD, responsáveis pelo tratamento, e conservação de documentos.]`,
  },
  {
    ...newSection("Lei aplicável e foro"),
    body: `[A preencher pelo advogado: lei portuguesa e foro competente.]

Documento {{contract.reference}}, gerado a {{today}}, com base na proposta aceite {{proposal.reference}}.`,
  },
];
