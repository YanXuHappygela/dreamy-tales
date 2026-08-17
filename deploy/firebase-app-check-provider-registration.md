# Firebase Console: Register Dreamy Tales App Check Providers

This guide registers the iOS and Android app identities with Firebase App Check. It does **not** yet make the existing public Cloud Run API private. Complete the gateway rollout only after real-device tokens have been validated.

## App Identifiers to Verify

The current Expo configuration declares the following identifiers. Confirm that these match the release app identifiers before registering any provider.

| Platform | Identifier from `app.config.ts` | Additional value needed |
|---|---|---|
| iOS | `space.manus.nighttime.story.app.t20260531023400` | Apple Developer team access and an App Attest capability in the native app target |
| Android | `space.manus.nighttime.story.app.t20260531023400` | SHA-256 fingerprint for the **release signing certificate**; if using Google Play, use the Play App Signing certificate |

> Do not use an Expo Go identifier for the production registration. App Check must be registered against the identifier and signing identity used by the custom development or production build you will distribute.

## Before You Start

1. Sign in to the [Firebase Console](https://console.firebase.google.com/) with an account that can administer project `dreamytales-498114`.
2. Select the **Dreamy Tales** Firebase project, or add Firebase to the Google Cloud project if it is not present yet.
3. In **Project settings → General**, confirm the iOS and Android apps are registered. If an app is missing, choose **Add app**, select the platform, and enter the identifier from the table above.
4. In the Firebase Console navigation, open **Security → App Check**. Keep enforcement off during this registration stage.

## Register the iOS Provider: App Attest

1. In **Security → App Check → Apps**, locate the registered iOS app. Select **Register**.
2. Select **App Attest** as the provider and confirm registration.
3. In the registration settings, retain the default **1-hour token TTL** initially. Firebase supports 30 minutes through 7 days; shorter values tighten the stolen-token window but trigger more attestations.[1]
4. In the Apple developer configuration for the same bundle ID, enable the **App Attest** capability.
5. In the native iOS target, add the App Attest capability and set the App Attest entitlement environment to `production`. App Check does not accept App Attest sandbox tokens.[1]
6. If the app supports devices before iOS 14, implement DeviceCheck as the App Check fallback. Do not silently accept an unverified device.
7. Produce an **Expo development build or production build**; Expo Go is not the production attestation target. Test on a physical iPhone or iPad.

### iOS Confirmation Checklist

| Check | Expected result |
|---|---|
| Firebase Console | The iOS app shows **App Attest** as its registered provider. |
| Native build | Firebase App Check is initialized before other Firebase SDKs. |
| Real device | The app obtains an App Check token without using a debug provider. |
| Gateway log | A request with `X-Firebase-AppCheck` is accepted by the gateway’s token verifier. |

## Register the Android Provider: Play Integrity

1. Open the [Google Play Console](https://play.google.com/console/). Create/select the Android app matching the package ID if it does not exist.
2. In **Release → App integrity → Play Integrity API**, choose **Link Cloud project**, then select `dreamytales-498114`. The account performing this action needs project-owner access; group-derived Owner access alone may not be sufficient.[2]
3. In the Firebase Console, return to **Security → App Check → Apps** and select the Android app’s **Register** action.
4. Select **Play Integrity** as the provider.
5. Enter the **SHA-256 fingerprint** of the Android release signing certificate. If you distribute via Google Play, obtain the SHA-256 from **Play Console → Release → Setup → App integrity → App signing**. Do not substitute the debug certificate fingerprint for production.
6. Choose advanced settings based on the distribution channel:

| Distribution | Play-recognized | Licensed | Minimum device integrity |
|---|---|---|---|
| Google Play only | Required | Required | Leave unspecified initially |
| Outside Google Play only | Not required | Not required | Device integrity |
| Both channels | Required | Not required | Leave unspecified initially |

7. Keep the default **1-hour token TTL** initially and register the provider.
8. Build and test a real Android device build. Configure the Android Firebase App Check Play Integrity provider before any other Firebase SDK call.

## Monitoring and Enforcement

Firebase Console enforcement controls Firebase-supported products. The Dreamy Tales gateway is a **custom backend**, so its protection is enforced by your gateway code: it must require `X-Firebase-AppCheck` and call Firebase Admin SDK `getAppCheck().verifyToken()` for every protected request.[3]

Use this staged rollout:

| Stage | Action | Exit criterion |
|---|---|---|
| 1. Register | Register both providers in Firebase Console; keep gateway in log-only mode for test devices. | Both platforms obtain valid tokens. |
| 2. Canary | Gateway verifies tokens but allows a tiny, monitored internal test cohort. | Valid requests pass; invalid/missing tokens are visible in logs. |
| 3. Enforce gateway | Reject missing/invalid App Check tokens with `401 UNAUTHENTICATED_APP`. | All supported production builds are sending tokens. |
| 4. Private core | Make the core Cloud Run service IAM-private and allow only the gateway service account to invoke it. | Direct core calls return `401/403`; gateway calls continue to work. |

Do not enable Firebase Console enforcement blindly expecting it to protect Cloud Run. Verify App Check at the gateway, then protect the core through Cloud Run IAM. Firebase notes that App Check mitigates some, not all, abuse; combine it with Cloud Armor and route-specific rate limits.[4]

## Debug and Test Safety

Use Firebase’s debug App Check provider only for simulator, CI, or explicitly registered development builds. Never ship a debug token in a production app. Keep a documented break-glass procedure to temporarily disable gateway enforcement only for an approved internal debug environment—not for the public service.

## References

[1] [Firebase — Get started using App Check with App Attest on Apple platforms](https://firebase.google.com/docs/app-check/ios/app-attest-provider)

[2] [Firebase — Get started using App Check with Play Integrity on Android](https://firebase.google.com/docs/app-check/android/play-integrity-provider)

[3] [Firebase — Verify App Check tokens from a custom backend](https://firebase.google.com/docs/app-check/custom-resource-backend)

[4] [Firebase — App Check](https://firebase.google.com/docs/app-check)
