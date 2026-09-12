type DisasterRuleInput = {
  type: string;
  secondaryRisks?: string[] | null;
};

type GeneratedWarning = {
  title: string;
  body: string;
  channel: string[];
};

const RULES: Record<string, GeneratedWarning[]> = {
  earthquake: [
    {
      title: "Secondary Tsunami Risk",
      body: "Coastal communities should monitor official evacuation notices due to possible tsunami activity.",
      channel: ["sms", "push", "email"]
    }
  ],
  flood: [
    {
      title: "Water Contamination Warning",
      body: "Avoid consuming unboiled water and use approved distribution points listed in the app.",
      channel: ["sms", "push"]
    }
  ],
  drought: [
    {
      title: "Dry Zone Fire Risk",
      body: "Hot and dry conditions can trigger secondary wildfires. Avoid open flames near vegetation.",
      channel: ["push", "email"]
    }
  ]
};

export function generateSecondaryWarnings(input: DisasterRuleInput): GeneratedWarning[] {
  const base = RULES[input.type.toLowerCase()] ?? [];
  const appended = (input.secondaryRisks ?? []).map((risk) => ({
    title: `${risk} advisory`,
    body: `Stay alert for ${risk.toLowerCase()} and follow official instructions in your area.`,
    channel: ["push"]
  }));
  return [...base, ...appended];
}
