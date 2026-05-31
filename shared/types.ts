// Shared types between client and server

export interface StoryConfig {
  childName: string;
  characterType: string;
  scenario: string;
  style: string;
  lengthMinutes: number; // 3–10
}

export interface GeneratedStory {
  title: string;
  paragraphs: string[];
  config: StoryConfig;
  generatedAt: string; // ISO date string
  id: string;
}

export interface SavedStory extends GeneratedStory {
  savedAt: string; // ISO date string
}
