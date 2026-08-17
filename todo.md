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
- [x] Synthesize all story narration paragraphs in parallel while retaining ordered playback and preparation progress
- [x] End every story with a child-addressed "Good night, sweet dreams" line in the selected language
- [x] Reduce the time required to generate and display a completed story
- [x] Verify parallel voice-synthesis request behavior and ordered narration playback
- [x] Prepare and deploy the Dreamy Tales backend and web experience on Google Cloud
- [x] Configure the stateless deployment for Google Cloud project dreamytales-498114
- [x] Verify and deploy the stateless backend in Cloud Run region us-central1
- [x] Create the approved Cloud Run, Cloud SQL, Secret Manager, and service-account resources
- [x] Keep generated stories and synthesized narration stored only on the local device after migration
- [x] Configure the Google Cloud backend as a stateless generation API with no story or audio archive
- [x] Deploy through keyless user-authorized Cloud Shell because service-account JSON keys are blocked by organization policy
- [x] Verify deployment permissions granted to dreamy-tales-deployer before resource creation
- [x] Grant the Cloud Run runtime service account scoped access to the database-password secret and retry deployment
- [x] Validate the live Cloud Run API and point the mobile client at https://dreamy-tales-api-883430697720.us-central1.run.app
- [x] Make the story-generation model and base prompt configurable through deployment settings
- [x] Set the default to the requested supported Gemini Flash model after catalog verification
- [x] Make story-generation temperature configurable through deployment settings
- [x] Fix the live Cloud SQL story_usage insert failure that blocks story generation
- [x] Raise the anonymous daily story-generation limit to 50
- [x] Inspect the live Cloud SQL story_usage table definition and repair its remaining insert constraint
- [x] Move anonymous daily-limit writes to a dedicated Cloud SQL counter table with a schema migration
- [x] Initialize the dedicated counter table with a one-time administrator connection and validate application-account access
- [x] Correct the application account’s effective INSERT and UPDATE privileges on anonymous_story_usage
- [x] Capture the underlying Cloud Run counter-write error and apply the database-compatible repair
- [x] Review app-to-server security risks and document prioritized mitigations
- [x] Revoke cloudsqlsuperuser from the Cloud SQL runtime application account and verify least-privilege grants
- [x] Restart and validate the Dreamy Tales development server
- [x] Design a secure mobile authentication or attestation gateway for private Cloud Run access
- [x] Document exact execution steps for Firebase App Check, gateway verification, and private Cloud Run rollout
- [x] Guide registration of iOS and Android Firebase App Check providers and a safe enforcement rollout
- [ ] Define enforcement so only verified Dreamy Tales mobile builds can access the private backend
- [x] Test and verify live enforcement of the 50-story anonymous daily limit
- [x] Remove the isolated 50-count daily-limit test row with the Cloud SQL administrator identity
- [x] Verify the existing UTC daily-limit reset boundary
- [x] Restore and deploy the structured daily-limit monitoring signal
- [x] Attach the verified GoogleAlert email channel to the repeated daily-limit alert policy
- [x] Verify Cloud Monitoring metric and alert policy 11435303686333956391 after deployment
- [x] Diagnose and fix the live story-generation stall or missing-output failure
- [x] Fix the on-device story-generation stall and leaked JSON artifact before the bedtime closing
- [x] Restore the Cloud Shell deployment account and publish the story-generation reliability repair
- [x] Verify live Cloud Run revision 00014-chz returns clean stories without JSON artifacts
- [x] Refresh the Create Story configuration header after settings changes so it shows the latest age and language
- [x] Add Panda, Spider, Bird, and Dog to the Main Character carousel
- [x] Restart and verify the unresponsive Dreamy Tales development preview
- [x] Publish the Dreamy Tales codebase to the YanXuHappygela GitHub account
- [x] Publish the Dreamy Tales GitHub repository with public visibility
- [x] Push the Dreamy Tales main branch to the new YanXuHappygela/dreamy-tales repository
- [x] Switch GitHub publishing authentication to YanXuHappygela
- [x] Verify YanXuHappygela GitHub authorization and push the prepared main branch
- [x] Prevent the web preview from requesting a wake lock while the page is hidden
