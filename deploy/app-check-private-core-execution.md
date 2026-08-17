# Dreamy Tales: App Check Gateway and Private Cloud Run Rollout

This guide keeps the current core service, `dreamy-tales-api`, private without placing a Google service-account key in the Expo application. Follow the stages in order. Do **not** enable private Cloud Run invocation until the gateway has passed its canary tests.

## 0. Set Shell Variables

Run these commands in Cloud Shell.

```bash
export PROJECT_ID=dreamytales-498114
export REGION=us-central1
export CORE_SERVICE=dreamy-tales-api
export EDGE_SERVICE=dreamy-tales-edge
export EDGE_SA=${EDGE_SERVICE}@${PROJECT_ID}.iam.gserviceaccount.com
export CORE_URL=https://dreamy-tales-api-883430697720.us-central1.run.app
```

Confirm the active project before proceeding:

```bash
gcloud config set project "$PROJECT_ID"
gcloud config get-value project
```

## 1. Add Firebase and Configure App Check

Enable the backend APIs required for the gateway. This command is safe to rerun.

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  firebase.googleapis.com \
  firebaseappcheck.googleapis.com \
  --project="$PROJECT_ID"
```

If the project has not yet been added to Firebase, install the Firebase CLI in Cloud Shell and attach Firebase resources:

```bash
npm install --global firebase-tools
firebase login
firebase projects:addfirebase "$PROJECT_ID"
```

In the [Firebase Console](https://console.firebase.google.com/), select project `dreamytales-498114`, then complete these configuration actions. They require the actual mobile identifiers and cannot safely be guessed:

| Platform | Firebase Console action | Attestation provider |
|---|---|---|
| iOS | Register the existing iOS bundle ID, then open **Build → App Check** | App Attest, with DeviceCheck as fallback |
| Android | Register the existing Android package and release SHA-256 certificate, then open **Build → App Check** | Play Integrity |
| Web preview, if retained | Register the web app and open **Build → App Check** | reCAPTCHA Enterprise |

Start in **monitoring** mode. Move to enforcement only after a production-like iOS and Android build returns valid tokens. Firebase App Check validates that calls originate from an app and device you registered; it complements, rather than replaces, user authentication.[1]

> Expo Go cannot host arbitrary native Firebase App Check providers. Use an Expo development build or production build with a compatible native Firebase integration. Never add a Firebase Admin credential, Google service-account key, or Cloud Run ID token to the mobile app.

## 2. Create the Gateway Service Account

Create a dedicated identity for the edge gateway. Do not create a key for it.

```bash
gcloud iam service-accounts create "$EDGE_SERVICE" \
  --project="$PROJECT_ID" \
  --display-name='Dreamy Tales App Check gateway'
```

Grant exactly two runtime permissions:

```bash
# Verify X-Firebase-AppCheck tokens.
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${EDGE_SA}" \
  --role='roles/firebaseappcheck.tokenVerifier'

# Invoke only the receiving core Cloud Run service.
gcloud run services add-iam-policy-binding "$CORE_SERVICE" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --member="serviceAccount:${EDGE_SA}" \
  --role='roles/run.invoker'
```

The `roles/firebaseappcheck.tokenVerifier` role permits App Check verification, and `roles/run.invoker` permits the gateway identity to invoke the specified Cloud Run service.[2] [3]

## 3. Create the Gateway Source

Create a separate local directory. The gateway validates App Check before proxying a request to the private core using its attached Cloud Run identity.

```bash
mkdir -p ~/dreamy-tales-edge && cd ~/dreamy-tales-edge
npm init -y
npm install express firebase-admin google-auth-library
```

Create `index.mjs`:

```js
import express from "express";
import { initializeApp } from "firebase-admin/app";
import { getAppCheck } from "firebase-admin/app-check";
import { GoogleAuth } from "google-auth-library";
import crypto from "node:crypto";

const app = express();
const coreUrl = process.env.CORE_URL;
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? "").split(",").map((x) => x.trim()).filter(Boolean),
);
const auth = new GoogleAuth();
initializeApp(); // Uses the attached Cloud Run service identity.

app.use(express.json({ limit: "256kb" }));

app.use(async (req, res) => {
  const origin = req.header("origin");
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);

  // Restrict the gateway to the intended API surface.
  if (!req.path.startsWith("/api/trpc/")) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }

  const token = req.header("X-Firebase-AppCheck");
  if (!token) return res.status(401).json({ error: "UNAUTHENTICATED_APP" });

  try {
    await getAppCheck().verifyToken(token);
  } catch {
    return res.status(401).json({ error: "UNAUTHENTICATED_APP" });
  }

  // Add an application rate limiter here before proxying production traffic.
  const requestId = crypto.randomUUID();
  try {
    const client = await auth.getIdTokenClient(coreUrl);
    const upstream = await client.request({
      url: `${coreUrl}${req.originalUrl}`,
      method: req.method,
      data: req.body,
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": requestId,
      },
      responseType: "arraybuffer",
      validateStatus: () => true,
    });
    const contentType = upstream.headers["content-type"] ?? "application/json";
    return res.status(upstream.status).setHeader("Content-Type", contentType).send(Buffer.from(upstream.data));
  } catch (error) {
    console.error(JSON.stringify({ requestId, message: String(error) }));
    return res.status(502).json({ error: "UPSTREAM_UNAVAILABLE", requestId });
  }
});

app.listen(process.env.PORT || 8080);
```

Create `package.json` scripts (or replace the generated scripts section):

```json
{
  "type": "module",
  "scripts": { "start": "node index.mjs" }
}
```

## 4. Deploy and Test the Public Gateway First

The gateway is intentionally public at this stage, but it rejects requests without a valid App Check token.

```bash
cd ~/dreamy-tales-edge
gcloud run deploy "$EDGE_SERVICE" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --source=. \
  --service-account="$EDGE_SA" \
  --allow-unauthenticated \
  --set-env-vars="CORE_URL=${CORE_URL},ALLOWED_ORIGINS=https://YOUR-PRODUCTION-WEB-ORIGIN"
```

Record the gateway URL:

```bash
export EDGE_URL=$(gcloud run services describe "$EDGE_SERVICE" \
  --project="$PROJECT_ID" --region="$REGION" --format='value(status.url)')
echo "$EDGE_URL"
```

Check the expected rejection path before integrating the phone:

```bash
curl -i "${EDGE_URL}/api/trpc/story.generate?batch=1"
```

Expected result: `401 UNAUTHENTICATED_APP` because no App Check token is included.

## 5. Add the Mobile App Check Header

In the mobile client, obtain a current App Check token using the native SDK integration and add it to every tRPC request:

```ts
const appCheckToken = await getAppCheckTokenFromNativeSdk();
return {
  "X-Firebase-AppCheck": appCheckToken,
};
```

Change the mobile `EXPO_PUBLIC_API_BASE_URL` from the core service URL to `EDGE_URL`. Build a custom development build for iOS/Android and verify a valid real-device token is accepted by the gateway.

## 6. Make the Core Service Private Only After Gateway Success

When an attested mobile request has successfully passed through the gateway, enable Cloud Run IAM invocation and remove public access:

```bash
gcloud run services update "$CORE_SERVICE" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --invoker-iam-check

gcloud run services remove-iam-policy-binding "$CORE_SERVICE" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --member='allUsers' \
  --role='roles/run.invoker' || true
```

Verify that direct public access fails:

```bash
curl -i "${CORE_URL}/api/health"
```

Expected result: `401` or `403`.

Verify the gateway identity can still access the core. From Cloud Shell, impersonate the gateway only if your user has permission to do so; otherwise run the gateway canary request from its Cloud Run logs/test environment:

```bash
gcloud run services get-iam-policy "$CORE_SERVICE" \
  --project="$PROJECT_ID" --region="$REGION"
```

The policy must list `dreamy-tales-edge@dreamytales-498114.iam.gserviceaccount.com` as `roles/run.invoker` and must not list `allUsers`.

## 7. Add Edge Abuse Protection

Place `dreamy-tales-edge` behind an external HTTPS load balancer and Cloud Armor. Start with a Cloud Armor throttle for the gateway’s generation route and tune it from logs. Cloud Armor supports per-client keys, throttling, and rate-based bans.[4]

Recommended initial controls:

| Layer | Initial control |
|---|---|
| Cloud Armor | 10 requests/minute/IP to story generation; 60 requests/minute/IP to synthesis; `429` on excess. |
| Gateway | 3 story requests/minute/attested app session; 20 paragraph syntheses/minute/attested app session. |
| Core | Keep the 50-story daily counter; reject requests that lack a trusted gateway marker if the design adds one. |
| Cloud Run | Cap max instances and concurrency to a spend-safe level. |

## References

[1] [Firebase — App Check](https://firebase.google.com/docs/app-check)

[2] [Firebase — Verify App Check tokens from a custom backend](https://firebase.google.com/docs/app-check/custom-resource-backend)

[3] [Google Cloud Run — Authenticating service-to-service](https://docs.cloud.google.com/run/docs/authenticating/service-to-service)

[4] [Google Cloud Armor — Rate limiting overview](https://docs.cloud.google.com/armor/docs/rate-limiting-overview)
