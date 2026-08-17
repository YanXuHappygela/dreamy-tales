# Secure Mobile Gateway for Dreamy Tales

## Recommendation

For the current **no-login** product, use **Firebase App Check plus a small public attestation gateway**, with the existing `dreamy-tales-api` service made private. Do not send a Google Cloud service-account key, a Cloud Run ID token, or a static “secret API key” in the Expo application.

The mobile application is an untrusted public client. It cannot safely hold the Google identity required by a private Cloud Run service. Instead, it proves that a request comes from an authentic app/device with an App Check token. A narrow gateway validates that proof, enforces abuse controls, and uses its own Google service identity to call the private service.

> **Recommended request path:**
>
> `Expo app → HTTPS load balancer + Cloud Armor → public attestation gateway → private Dreamy Tales API → Gemini / Google TTS / Cloud SQL`

| Component | Access model | Responsibility |
|---|---|---|
| Expo application | Public client | Obtains an App Check token; calls only the gateway; never holds privileged Google credentials. |
| HTTPS load balancer + Cloud Armor | Internet-facing | TLS, WAF, per-client throttling, and DDoS/abuse mitigation. |
| `dreamy-tales-edge` gateway | Public, App Check required | Validates App Check, applies endpoint quotas, CORS policy, request-size limits, and request IDs. |
| `dreamy-tales-api` core service | Private Cloud Run service | Generates stories, invokes TTS, and accesses Cloud SQL. Accepts calls only from the gateway service account. |
| Firebase App Check | Attestation | Demonstrates that a request originated from the registered app/device; it is not a substitute for user identity. |

Firebase App Check supports custom backends: the app sends an `X-Firebase-AppCheck` token and the backend validates it with Firebase Admin SDK before handling the request.[1] Cloud Run service-to-service authentication uses a dedicated service account with `roles/run.invoker` and a Google-signed OpenID Connect ID token.[2]

## Why this fits the current product

The app intentionally has no sign-in screen, so pure Cloud Run IAM is not sufficient: an unauthenticated phone cannot mint a Google service-account ID token safely. App Check adds device/app attestation without requiring a child or caregiver account. The gateway then bridges the public mobile request to the private Cloud Run service using a server-side identity.

For iOS, use **App Attest** where available, with DeviceCheck as a fallback. For Android, use **Play Integrity**. Firebase documents these as built-in App Check providers for the corresponding platforms.[3] Expo Go is not sufficient for this native integration; use an Expo development build or production build with a compatible native Firebase module.

## Implementation Sequence

### 1. Create and register Firebase App Check

Create or link a Firebase project to `dreamytales-498114`. Register the iOS bundle ID and Android package/signing certificate. Enable App Check with App Attest/DeviceCheck for iOS and Play Integrity for Android. Begin in monitoring mode, then enforce only after real-device token success has been measured.

In the mobile application, obtain a token before each protected request and attach it as:

```http
X-Firebase-AppCheck: <app-check-token>
```

Do not place a Firebase Admin credential or Google service-account JSON in the Expo application.

### 2. Deploy the public edge gateway

Create a separate Cloud Run service, `dreamy-tales-edge`, with a dedicated runtime service account such as `dreamy-tales-edge@dreamytales-498114.iam.gserviceaccount.com`.

The gateway should:

1. Require and validate `X-Firebase-AppCheck` using the Firebase Admin SDK.
2. Restrict CORS to known web origins; native clients do not need permissive credentialed CORS.
3. Enforce short-window limits, for example **3 generation requests per minute** and **20 TTS paragraphs per minute** per attested app/session, in addition to the existing 50-per-day rule.
4. Set a small JSON request limit, reject unsupported paths, redact internal exceptions, and emit a request ID.
5. Forward only validated payloads to the private service using an OIDC ID token created from the gateway’s Cloud Run service identity.

Example Node.js middleware for token verification:

```ts
import { initializeApp } from "firebase-admin/app";
import { getAppCheck } from "firebase-admin/app-check";

initializeApp();

export async function requireAppCheck(req, res, next) {
  const token = req.header("X-Firebase-AppCheck");
  if (!token) return res.status(401).json({ error: "UNAUTHENTICATED_APP" });
  try {
    req.appCheck = await getAppCheck().verifyToken(token);
    return next();
  } catch {
    return res.status(401).json({ error: "UNAUTHENTICATED_APP" });
  }
}
```

Grant the gateway runtime service account the **Firebase App Check Token Verifier** role needed for verification.[1]

### 3. Make the core Cloud Run service private

Grant only the gateway identity permission to invoke the core service:

```bash
gcloud run services add-iam-policy-binding dreamy-tales-api \
  --project=dreamytales-498114 \
  --region=us-central1 \
  --member='serviceAccount:dreamy-tales-edge@dreamytales-498114.iam.gserviceaccount.com' \
  --role='roles/run.invoker'
```

Then require IAM invocation and remove public access:

```bash
gcloud run services update dreamy-tales-api \
  --project=dreamytales-498114 \
  --region=us-central1 \
  --invoker-iam-check

gcloud run services remove-iam-policy-binding dreamy-tales-api \
  --project=dreamytales-498114 \
  --region=us-central1 \
  --member='allUsers' \
  --role='roles/run.invoker' || true
```

The gateway must then mint an ID token whose audience is the private core service URL and send it in `Authorization: Bearer <ID_TOKEN>`. Cloud Run documents this service-to-service model and recommends a per-service, least-privilege identity.[2]

### 4. Put the gateway behind an edge policy

Use an external HTTPS load balancer with Cloud Armor in front of `dreamy-tales-edge`. Configure separate Cloud Armor throttles for generation and TTS routes. Cloud Armor supports per-client IP and X-Forwarded-For keys, throttling, and rate-based bans.[4]

Set the core service ingress to **internal and Cloud Load Balancing** when the load-balancer topology is complete. Disable the default `run.app` URL if the chosen setup supports it, so direct callers cannot bypass the edge layer.[5]

## Optional User Authentication

If you later add caregiver accounts, add Firebase Authentication or Identity Platform **in addition to** App Check:

| Control | Protects | Use in Dreamy Tales |
|---|---|---|
| App Check | Your backend from forged/non-authentic clients | Required for anonymous/no-login access. |
| Firebase Auth / Identity Platform | A caregiver’s account and cross-device data | Add for paid plans, cloud sync, and parental controls. |
| Cloud Run IAM | The core service from arbitrary callers | Required between gateway and private core service. |

The gateway should verify both the Firebase ID token and App Check token when accounts are introduced. A static API key in the app is neither a user credential nor an adequate abuse-control mechanism.

## Rollout and Validation Checklist

| Stage | Success criterion |
|---|---|
| Monitor | Real iOS and Android builds obtain valid App Check tokens; invalid-token events are logged. |
| Gateway canary | Gateway rejects missing/invalid App Check headers with 401 and successfully reaches the core using its service identity. |
| Private core | Direct calls to the `dreamy-tales-api` URL return 401/403; gateway calls succeed. |
| Edge protection | Cloud Armor throttles test bursts with 429 while valid normal usage remains functional. |
| Production | Secret scanning confirms no privileged credential exists in the mobile bundle; dashboards alert on 401, 429, cost, and error spikes. |

## References

[1] [Firebase — Verify App Check tokens from a custom backend](https://firebase.google.com/docs/app-check/custom-resource-backend)

[2] [Google Cloud Run — Authenticating service-to-service](https://docs.cloud.google.com/run/docs/authenticating/service-to-service)

[3] [Firebase — App Check](https://firebase.google.com/docs/app-check)

[4] [Google Cloud Armor — Rate limiting overview](https://docs.cloud.google.com/armor/docs/rate-limiting-overview)

[5] [Google Cloud Run — Security design overview](https://docs.cloud.google.com/run/docs/securing/security)
