# Dreamy Tales — Design Document

## App Overview
A nighttime bedtime story app for children aged 3–6. Parents/caregivers configure the story parameters, the app generates a personalised bedtime story using AI, and reads it aloud with a soothing voice.

---

## Brand & Color Palette

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `background` | `#0D0B2B` | `#0D0B2B` | Deep midnight navy — always dark |
| `surface` | `#1A1740` | `#1A1740` | Card/panel background |
| `primary` | `#C8A2E8` | `#C8A2E8` | Soft lavender — CTA buttons |
| `foreground` | `#F0EAF8` | `#F0EAF8` | Primary text |
| `muted` | `#9B8BB4` | `#9B8BB4` | Secondary text / labels |
| `border` | `#2E2A5A` | `#2E2A5A` | Card borders |
| `success` | `#7BE8A0` | `#7BE8A0` | Completion states |
| `warning` | `#FFD580` | `#FFD580` | Moon/star accent |
| `error` | `#F87171` | `#F87171` | Error states |

The app always uses a dark nighttime theme regardless of device light/dark mode setting.

---

## Screen List

### 1. Home / Welcome Screen (`app/(tabs)/index.tsx`)
The landing screen. Shows the app name "Dreamy Tales", a glowing moon illustration, and a prominent "Create a Story" button. Also shows a "Recent Stories" section (last 3 generated stories stored locally).

### 2. Story Config Screen (`app/config.tsx`)
Full-screen scrollable configuration form with these sections:
- **Character**: Child's name (text input) + character type picker (e.g. Bunny, Dragon, Princess, Robot, Unicorn, Bear)
- **Scenario**: Where the story takes place (Forest, Space, Ocean, Castle, Jungle, Cloud Kingdom)
- **Style**: Story mood/tone (Funny, Magical, Adventurous, Cozy, Mysterious)
- **Length**: Slider from 3 min to 10 min (step: 1 min) — controls story word count
- A large "Generate Story" button at the bottom

### 3. Story Display / Reading Screen (`app/story.tsx`)
Full-screen immersive reading experience:
- Animated starfield background
- Story title at top
- Scrollable story text (large, readable font — min 18sp)
- Bottom control bar: Play/Pause button, progress indicator, Stop button
- "Save Story" button (saves to local history)
- Back button to return to config

### 4. Story History Screen (`app/(tabs)/history.tsx`)
List of previously generated stories stored in AsyncStorage. Each card shows title, character name, date, and length. Tap to re-read. Swipe to delete.

---

## Key User Flows

### Generate & Read Flow
1. Home screen → tap "Create a Story"
2. Config screen → fill in character, scenario, style, length → tap "Generate Story"
3. Loading screen (animated moon + stars, "Weaving your story…")
4. Story display screen → story text appears → auto-starts reading aloud
5. User can pause/resume/stop narration
6. Tap "Save Story" → story saved to history

### Re-read Saved Story Flow
1. Home screen → tap a recent story card (or navigate to History tab)
2. Story display screen → story text shown → tap Play to read aloud

---

## Navigation Structure

```
Tab Bar
├── Home (house.fill icon)
└── History (book.fill icon)

Modal / Stack screens
├── /config     ← Story configuration
└── /story      ← Story reading screen
```

---

## Typography
- Headings: Bold, 28–32sp, `#F0EAF8`
- Body (story text): Regular, 18–20sp, line-height 1.7, `#F0EAF8`
- Labels: Medium, 14sp, `#9B8BB4`
- Buttons: SemiBold, 16sp

---

## Interaction Design
- Config options use large tap targets (min 48×48dp) — child-friendly
- Story length uses a custom slider with moon/star visual markers
- Story reading screen uses `expo-keep-awake` to prevent screen sleep
- Haptic feedback on button presses
- Smooth fade-in animation when story text loads
- Twinkling star particles in the background of the story screen
