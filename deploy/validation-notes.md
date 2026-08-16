# Google Cloud Deployment Validation Notes

## Verified

- Signed-in Google Cloud Console access is available for project `dreamytales-498114` (displayed as **DreamyTales**).
- The target Cloud Run region is `us-central1`.
- The service is configured to use Vertex AI Gemini from the global endpoint through its Cloud Run service identity.
- Story text and synthesized MP3 narration are saved on the phone; the API no longer archives narration files.
- Runtime service account `dreamy-tales-api@dreamytales-498114.iam.gserviceaccount.com` has been created and granted the Cloud Run workload permissions needed for Vertex AI, Cloud SQL connectivity, and authenticated Google API consumption.
- Cloud SQL instance `dreamy-tales-db` is `RUNNABLE` in `us-central1` with connection name `dreamytales-498114:us-central1:dreamy-tales-db`. It has a connector-compatible public IP but no authorized public networks; Cloud Run connects through the Cloud SQL Unix socket.
- Database `dreamy_tales`, application user `dreamy_tales`, and Secret Manager secret `dreamy-tales-db-password` (version 1) are created. The password itself is not retained in these notes.
- Cloud Build's default Compute Engine service account was granted `roles/storage.objectViewer` after the first source-build attempt was denied access to the Cloud Run source bucket.

## Active deployment

- A replacement Cloud Run build is currently in progress for service `dreamy-tales-api`.
- Cloud Shell is using the user-approved keyless deployment path; no downloadable service-account key was created.
- The initial source build `62655279-f802-4226-be95-4564c2ae86ed` failed because the default Cloud Build Compute Engine service account lacked `roles/logging.logWriter`. That minimal role has now been granted through the Cloud Build console.
- Retry build `9dee4f22-3f88-4626-8962-031510512a91` is running in `us-central1`; its container-build step has completed successfully and the Cloud Run release is still pending.
- Retry build `9dee4f22-3f88-4626-8962-031510512a91` later failed while pushing the image because `883430697720-compute@developer.gserviceaccount.com`, the default Cloud Build Compute Engine service account, lacks `artifactregistry.repositories.uploadArtifacts`. It needs the scoped `roles/artifactregistry.writer` role before the build can be retried.
- After that role was granted, Cloud Build `5ed923c0-18b3-436e-a6c2-fc7a3fb98b63` completed successfully. This retry built and pushed the container only; it did not resume the original `gcloud run deploy` process, so the `dreamy-tales-api` Cloud Run service has not yet been created.

## Authentication note

Cloud Text-to-Speech supports Application Default Credentials on Google Cloud workloads. The Cloud Run runtime service account is attached to the service rather than given a downloadable key. The runtime has `roles/serviceusage.serviceUsageConsumer` for authenticated Google API consumption. Source: https://docs.cloud.google.com/text-to-speech/docs/authentication
