# Dreamy Tales — Google Cloud Run Deployment

The backend is designed to run as a **stateless Cloud Run API**. Story text and synthesized MP3 narration are returned to the device and saved only in the app's private storage. The remote database is used solely for the anonymous daily usage counter.

## Required Google Cloud resources

Use project `dreamytales-498114`. Enable Cloud Run, Cloud Build, Artifact Registry, Gemini Enterprise Agent Platform (Vertex AI), Cloud Text-to-Speech, and Cloud SQL Admin APIs. Deploy the service with a dedicated service account that has `roles/aiplatform.user` for Gemini and `roles/texttospeech.user` for narration. Attach a Cloud SQL MySQL instance for the daily limit database.

## Required runtime settings

| Setting | Source |
|---|---|
| `GOOGLE_CLOUD_PROJECT` | Cloud Run environment variable: `dreamytales-498114` |
| `GOOGLE_CLOUD_LOCATION` | Cloud Run environment variable: `global` |
| `STORY_LLM_MODEL` | Cloud Run environment variable. Default: `gemini-3.7-flash`. Change it to use another supported Gemini model. |
| `STORY_LLM_TEMPERATURE` | Cloud Run environment variable. Default: `0.7`; accepted range: `0`–`2`. |
| `STORY_BASE_PROMPT` | Optional Cloud Run environment variable that replaces the default author-persona opening instruction. All child-safety, length, JSON, and localized-ending rules remain enforced by the server. |
| `DATABASE_SOCKET_PATH` | Cloud SQL Unix socket mounted by Cloud Run |
| `DATABASE_USER` and `DATABASE_NAME` | Non-secret Cloud SQL application user and database name |
| `DATABASE_PASSWORD` | Secret Manager secret mounted as an environment variable |

## Deployment command

After creating the Cloud Run service account, Secret Manager secret, and Cloud SQL instance, deploy with a region near the target users:

```bash
gcloud run deploy dreamy-tales-api \
  --project=dreamytales-498114 \
  --source=. \
  --region=YOUR_CLOUD_RUN_REGION \
  --allow-unauthenticated \
  --service-account=dreamy-tales-api@dreamytales-498114.iam.gserviceaccount.com \
  --add-cloudsql-instances=dreamytales-498114:us-central1:dreamy-tales-db \
  --set-env-vars=GOOGLE_CLOUD_PROJECT=dreamytales-498114,GOOGLE_CLOUD_LOCATION=global,STORY_LLM_MODEL=gemini-3.7-flash,STORY_LLM_TEMPERATURE=0.7,DATABASE_SOCKET_PATH=/cloudsql/dreamytales-498114:us-central1:dreamy-tales-db,DATABASE_USER=dreamy_tales,DATABASE_NAME=dreamy_tales \
  --set-secrets=DATABASE_PASSWORD=dreamy-tales-db-password:latest
```

Update the mobile build setting `EXPO_PUBLIC_API_BASE_URL` to the returned Cloud Run URL before producing a new mobile build.

## Changing the story model, creativity, or author voice

Open the Cloud Run service, create a new revision, and edit the three non-secret environment variables. `STORY_LLM_MODEL` selects the model, `STORY_LLM_TEMPERATURE` controls variation from `0` to `2`, and `STORY_BASE_PROMPT` changes the author persona. A prompt change does not remove the server-enforced JSON format, age guidance, child-safe content rules, unique main-character name, or localized good-night closing.
