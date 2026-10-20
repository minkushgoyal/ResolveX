import type { ComplaintCategory, ComplaintPriority } from "@resolvex/types";

export interface ComplaintSuggestion {
  category: ComplaintCategory;
  priority: ComplaintPriority;
  suggestedTitle: string;
  suggestedDescription: string;
  source: "local_rules" | "ai_provider";
}

const categoryRules: Array<{ terms: string[]; category: ComplaintCategory; priority: ComplaintPriority }> = [
  { terms: ["leak", "pipe", "tap", "water"], category: "plumbing", priority: "medium" },
  { terms: ["spark", "wire", "electric", "power"], category: "electrical", priority: "high" },
  { terms: ["lift", "elevator", "stuck"], category: "lift", priority: "high" },
  { terms: ["guard", "gate", "theft", "unsafe"], category: "security", priority: "high" },
  { terms: ["fire", "smoke", "medical", "emergency"], category: "security", priority: "emergency" }
];

export function suggestComplaint(input: string): ComplaintSuggestion {
  const normalized = input.toLowerCase();
  const match = categoryRules.find((rule) => rule.terms.some((term) => normalized.includes(term)));
  const category = match?.category ?? "other";
  const priority = match?.priority ?? "medium";

  return {
    category,
    priority,
    suggestedTitle: input.length > 54 ? `${input.slice(0, 54).trim()}...` : input,
    suggestedDescription: `Resident reported: ${input.trim()}\n\nPlease inspect the issue, add work notes, and upload proof before marking it completed.`,
    source: "local_rules"
  };
}

export const classifyComplaint = suggestComplaint;
