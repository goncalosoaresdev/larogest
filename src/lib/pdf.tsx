import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { formatDateLong } from "@/lib/format";
import type { TemplateSection } from "@/lib/labels";

/** Tokens from laro.pt — paper, olive, ink. */
const color = {
  paper: "#f3f0e8",
  ink: "#20241f",
  inkSoft: "#5f625b",
  olive: "#59634f",
  oliveDark: "#394237",
  line: "#d8cdbb",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 52,
    paddingHorizontal: 48,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: color.ink,
    backgroundColor: color.paper,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 10,
  },
  wordmark: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: color.oliveDark,
    letterSpacing: 0.4,
  },
  kind: {
    fontSize: 9,
    color: color.olive,
  },
  title: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: color.ink,
    marginBottom: 4,
  },
  meta: {
    fontSize: 9,
    color: color.inkSoft,
    marginBottom: 16,
  },
  rule: {
    height: 1,
    backgroundColor: color.line,
    marginBottom: 22,
  },
  section: {
    marginBottom: 16,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginBottom: 6,
  },
  sectionIndex: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: color.olive,
    width: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: color.oliveDark,
  },
  paragraph: {
    lineHeight: 1.5,
    marginBottom: 4,
  },
  listRow: {
    flexDirection: "row",
    marginBottom: 3,
    paddingLeft: 2,
  },
  bullet: {
    width: 12,
    color: color.olive,
  },
  listText: {
    flex: 1,
    lineHeight: 1.45,
  },
  spacer: {
    height: 7,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
  },
  footerRule: {
    height: 1,
    backgroundColor: color.line,
    marginBottom: 8,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: color.inkSoft,
  },
  stamp: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: color.line,
    fontSize: 8,
    color: color.inkSoft,
    lineHeight: 1.4,
  },
});

type PdfDoc = {
  kind: "Proposta" | "Contrato";
  reference: string;
  subtitle: string;
  sections: TemplateSection[];
  stamp?: string;
};

function SectionBody({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <View>
      {lines.map((line, index) => {
        if (line.trim() === "") {
          return <View key={index} style={styles.spacer} />;
        }
        if (line.startsWith("•")) {
          return (
            <View key={index} style={styles.listRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listText}>{line.replace(/^•\s*/, "")}</Text>
            </View>
          );
        }
        return (
          <Text key={index} style={styles.paragraph}>
            {line}
          </Text>
        );
      })}
    </View>
  );
}

function LaroPdf({ kind, reference, subtitle, sections, stamp }: PdfDoc) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.wordmark}>Laro</Text>
          <Text style={styles.kind}>{kind}</Text>
        </View>
        <Text style={styles.title}>{subtitle}</Text>
        <Text style={styles.meta}>
          {reference} · {formatDateLong(new Date())}
        </Text>
        <View style={styles.rule} />

        {sections.map((section, index) => (
          <View key={section.id} style={styles.section} wrap>
            <View style={styles.sectionHead} minPresenceAhead={40}>
              <Text style={styles.sectionIndex}>{String(index + 1).padStart(2, "0")}</Text>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            <SectionBody text={section.body} />
          </View>
        ))}

        {stamp ? <Text style={styles.stamp}>{stamp}</Text> : null}

        <View style={styles.footer} fixed>
          <View style={styles.footerRule} />
          <View style={styles.footerRow}>
            <Text>laro.pt · Centro de Portugal</Text>
            <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function renderDocumentPdf(doc: PdfDoc) {
  return renderToBuffer(<LaroPdf {...doc} />);
}
