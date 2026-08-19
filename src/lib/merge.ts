import { nanoid } from "nanoid";
import type { TemplateSection } from "@/lib/labels";

export type MergeContext = Record<string, unknown>;

function getPath(source: MergeContext, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, source);
}

export function mergeText(template: string, context: MergeContext) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, path: string) => {
    const value = getPath(context, path);
    if (value === null || value === undefined || value === "") return "—";
    return String(value);
  });
}

export function mergeSections(sections: TemplateSection[], context: MergeContext): TemplateSection[] {
  return sections.map((section) => ({
    ...section,
    title: mergeText(section.title, context),
    body: mergeText(section.body, context),
  }));
}

export function newSection(title = "Nova secção"): TemplateSection {
  return { id: nanoid(8), title, body: "" };
}
