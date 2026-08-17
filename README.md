# Dreamy Tales

**Dreamy Tales** is a gentle bedtime-story companion for young children. Caregivers choose a main character, setting, style, and story length; the app then creates a personalized story and can read it aloud with a selected narrator voice.

## Product features

| Feature | What it offers |
| --- | --- |
| **Personalized stories** | Choose from kid-friendly characters, settings, and story styles, or add a custom story idea. |
| **Three languages** | Create and narrate stories in English, Mandarin, or Spanish. |
| **Flexible bedtime listening** | Select a narrator voice and reading speed, then play a prepared story from beginning to end. |
| **A child-friendly library** | Save stories and narration on the device for later reading and listening. |
| **Caregiver settings** | Keep a child’s preferred name, age group, language, and voice ready for the next story. |
| **Bedtime finishing touch** | Every story closes with a localized good-night wish for the child. |

## High-level technology

Dreamy Tales is a cross-platform mobile application built with **Expo and React Native**. It uses an **AI story-generation service** to create bedtime stories and a **cloud voice service** for narrator audio. Stories and prepared narration are kept on the child’s device.

## Run from source

Install the project dependencies, then start the development experience:

```bash
pnpm install
pnpm dev
```

To check the code before building, run:

```bash
pnpm test
pnpm check
```

## Build a mobile package

Dreamy Tales can be packaged with Expo’s cloud build service. You will need an Expo account and the appropriate Apple or Android signing setup for the platform you choose.

```bash
# Sign in to your Expo account
npx expo login

# Prepare cloud build settings on the first run
npx eas build:configure

# Create an Android package
npx eas build --platform android

# Create an iOS package
npx eas build --platform ios
```

Follow the prompts from the build service to download the completed package. Before distributing an app-store build, review the app name, version, and platform identifiers in `app.config.ts`.

## License

This project is licensed under the [Apache License 2.0](LICENSE).
