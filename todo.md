# Dreamy Tales — Project TODO

## Branding & Setup
- [x] Generate app icon (moon + storybook illustration)
- [x] Copy icon to all asset locations
- [x] Write design.md
- [x] Update app.config.ts with app name and logo URL
- [x] Update theme.config.js with nighttime color palette

## Navigation & Screens
- [x] Add History tab to tab bar with book icon
- [x] Create /config screen (story configuration)
- [x] Create /story screen (story display + read-aloud)
- [x] Update Home screen with welcome UI and recent stories

## Story Config Screen
- [x] Character name text input
- [x] Character type picker (Bunny, Dragon, Princess, Robot, Unicorn, Bear)
- [x] Scenario picker (Forest, Space, Ocean, Castle, Jungle, Cloud Kingdom)
- [x] Story style picker (Funny, Magical, Adventurous, Cozy, Mysterious)
- [x] Story length slider (3–10 minutes, step 1 min)
- [x] "Generate Story" button

## AI Story Generation (Backend)
- [x] Add tRPC route: story.generate (publicProcedure)
- [x] Build LLM prompt that uses character, scenario, style, and length
- [x] Return structured story (title + body paragraphs)

## Story Display & Read-Aloud
- [x] Display story title and body text
- [x] Integrate expo-speech for TTS narration
- [x] Play/Pause/Stop controls
- [x] Progress indicator during narration
- [x] expo-keep-awake to prevent screen sleep during reading
- [x] Animated starfield background

## Story History
- [x] Save generated story to AsyncStorage
- [x] History tab screen with story cards
- [x] Tap card to re-read story
- [x] Delete story from history

## Polish & UX
- [x] Nighttime theme applied globally (dark background always)
- [x] Smooth fade-in animation for story text
- [x] Loading animation ("Weaving your story…") during generation
- [x] Haptic feedback on primary actions
- [x] Child-friendly large tap targets on all pickers
