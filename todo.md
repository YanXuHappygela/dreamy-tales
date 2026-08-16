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

## New Features (Round 2)
- [x] Custom character text input (alongside preset character chips)
- [x] Language selector: Mandarin, English, Spanish
- [x] Update StoryConfig type with language and voiceId fields
- [x] Voice selection screen/section: load expo-speech voices filtered by language
- [x] Update server LLM prompt to generate story in selected language
- [x] Wire selected voiceId to expo-speech speak() call in story screen
- [x] Persist language + voice preferences in AsyncStorage

## Voice Picker Fix (Round 3)
- [x] Load real device voices via Speech.getAvailableVoicesAsync()
- [x] Show actual voice name, locale, and quality badge (Enhanced/Default)
- [x] Remove hardcoded fallback voices — show "no voices" message if device has none
- [x] Fix preview: stop any ongoing speech before starting new preview
- [x] Auto-select first real voice when language changes
- [x] Handle web platform gracefully (expo-speech voices not available on web)

## Security & Community (Round 4)
- [x] Move Google TTS API key from URL query param to Authorization header
- [x] Add community_posts table to database schema
- [x] Add server endpoints: community.list, community.post, community.delete
- [x] Add Community tab to tab bar
- [x] Build Community screen: browse posted stories with author, date, character, language
- [x] Add "Share to Community" button on story reading screen
- [x] Add "Download to My Library" button on community story cards

## Round 5: Likes, Filters, Rate Limiting
- [x] Add likeCount column to community_posts table
- [x] Add community.like server endpoint
- [x] Add heart/like button on community cards with local persistence
- [x] Add filter bar on Community screen (language, character, style)
- [x] Add in-memory rate limiting on community.post (max 5/hour per IP)
- [x] Add in-memory rate limiting on story.generate (max 10/hour per IP)

## Settings Screen (Round 6)
- [x] Create /settings screen with child name, age group, language, voice preference
- [x] Add gear icon to Home screen top-right corner
- [x] Remove child name, age group, language, voice from config screen
- [x] Config screen reads child name/age/language/voice from Settings AsyncStorage
- [x] Remove all login and OAuth user-interface flows
- [x] Set a simple IP-based daily story-generation limit of 10
