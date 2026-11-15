import type { Automation, KeywordGroup, KeywordVariant } from "./types";

export type Translate = (uz: string, ru: string, en: string) => string;

// Draft IDs also keep React keys stable while the user edits or reorders rows.
export function newGroup(name: string, priority: number, keywords: string[] = [], dm = "", publicReply = ""): KeywordGroup {
  return {
    id: crypto.randomUUID(), name, priority, enabled: true, fuzzy_enabled: false, fuzzy_max_distance: 1,
    variants: keywords.map(text => ({ id: crypto.randomUUID(), kind: "primary", text, enabled: true })),
    dm_templates: [{ id: crypto.randomUUID(), text: dm, enabled: true }],
    public_templates: publicReply ? [{ id: crypto.randomUUID(), text: publicReply, enabled: true }] : [],
    variables: {},
  };
}

export function groupSummary(rule: Pick<Automation, "keywords" | "keyword_groups">) {
  return rule.keyword_groups?.length ? rule.keyword_groups.map(g => g.name).join(" · ") : rule.keywords.join(", ");
}
export function validKeywords(groups: KeywordGroup[]) {
  return groups.every(g => g.name.trim() && (!g.enabled || g.variants.some(v => v.enabled && v.kind === "primary" && v.text.trim())));
}
export function validReplies(groups: KeywordGroup[]) {
  return groups.every(g => !g.enabled || g.dm_templates.some(t => t.enabled && t.text.trim()));
}
export function copyGroups(groups: KeywordGroup[]) {
  return groups.map(g => ({ ...g, id: crypto.randomUUID(), variants: g.variants.map(v => ({ ...v, id: crypto.randomUUID() })),
    dm_templates: g.dm_templates.map(t => ({ ...t, id: crypto.randomUUID() })),
    public_templates: g.public_templates.map(t => ({ ...t, id: crypto.randomUUID() })) }));
}
export function splitVariants(value: string, kind: KeywordVariant["kind"], group: KeywordGroup) {
  const old = group.variants.filter(v => v.kind === kind);
  return [...group.variants.filter(v => v.kind !== kind),
    ...Array.from(new Set(value.split(/[,\n]/).map(v => v.trim()).filter(Boolean))).map(text =>
      old.find(v => v.text === text) ?? { id: crypto.randomUUID(), text, kind, enabled: true })];
}
