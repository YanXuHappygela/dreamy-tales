// Shared types between client and server

export type StoryLanguage = "English" | "Mandarin" | "Spanish";
export type AgeGroup = "3-4" | "5-6" | "7-8" | "8+";

export interface StoryConfig {
  childName: string;
  characterType: string;       // preset label OR "Custom"
  customCharacter?: string;    // filled when characterType === "Custom"
  scenario: string;
  style: string;
  lengthMinutes: number;       // 3–10
  language: StoryLanguage;
  ageGroup: AgeGroup;          // target age group
  voiceId?: string;            // expo-speech voice identifier (optional)
  storyIdea?: string;          // optional free-text story line description
}

export interface GeneratedStory {
  title: string;
  paragraphs: string[];
  config: StoryConfig;
  generatedAt: string;         // ISO date string
  id: string;
}

export interface SavedStory extends GeneratedStory {
  savedAt: string;             // ISO date string
}
