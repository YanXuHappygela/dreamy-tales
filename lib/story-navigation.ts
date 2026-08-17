import AsyncStorage from "@react-native-async-storage/async-storage";

import type { GeneratedStory } from "@/shared/types";

const ACTIVE_STORY_STORAGE_KEY = "dreamy_tales_active_story";

/**
 * Stores the current story locally before navigating. Passing only the small
 * identifier through Expo Router avoids truncating long story JSON in a URL.
 */
export async function saveActiveStory(story: GeneratedStory): Promise<string> {
  await AsyncStorage.setItem(ACTIVE_STORY_STORAGE_KEY, JSON.stringify(story));
  return story.id;
}

/** Reads the most recently navigated story and verifies the expected ID. */
export async function loadActiveStory(storyId?: string): Promise<GeneratedStory | null> {
  const raw = await AsyncStorage.getItem(ACTIVE_STORY_STORAGE_KEY);
  if (!raw) return null;

  try {
    const story = JSON.parse(raw) as GeneratedStory;
    if (storyId && story.id !== storyId) return null;
    return story;
  } catch {
    return null;
  }
}
