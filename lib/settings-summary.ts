export interface SettingsSummaryInput {
  childName?: string;
  ageGroup: string;
  language: string;
}

/** Builds the compact, current-preferences label shown above story choices. */
export function buildSettingsSummary({ childName, ageGroup, language }: SettingsSummaryInput): string {
  const name = childName?.trim();
  return [
    name ? `👤 ${name}` : null,
    `🎂 ${ageGroup} yrs`,
    `🌐 ${language}`,
  ].filter(Boolean).join("  · ");
}
