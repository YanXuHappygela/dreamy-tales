# Repeated Daily-Limit Alert

When a device reaches its 50-story UTC daily limit, the backend emits this aggregate Cloud Run warning without an IP address or client key:

```json
{"severity":"WARNING","event":"daily_limit_reached","service":"dreamy-tales-api","limit":50,"resetBoundary":"UTC_MIDNIGHT"}
```

The deployment script creates the `dreamy_tales_daily_limit_hits` log-based counter metric and an alert policy attached to the verified **GoogleAlert** email channel. The policy opens an incident for more than 10 hits in a 10-minute window and auto-closes after 30 minutes.

## Activate

After deploying the application revision containing the structured log, run from the project source directory in Cloud Shell:

```bash
cd deploy/monitoring
chmod +x create-daily-limit-alert.sh
PROJECT_ID=dreamytales-498114 ./create-daily-limit-alert.sh
```

## Verify

```bash
gcloud logging metrics describe dreamy_tales_daily_limit_hits --project=dreamytales-498114
gcloud monitoring policies list --project=dreamytales-498114 --format='table(displayName,enabled)'
```

In Logs Explorer, use:

```text
resource.type="cloud_run_revision"
resource.labels.service_name="dreamy-tales-api"
jsonPayload.event="daily_limit_reached"
```

Cloud Run recognizes JSON written to standard output or standard error as structured log data, enabling log filters and log-based metrics.[1] Cloud Monitoring supports policies over log-based metric counters.[2]

[1] [Google Cloud Logging — Structured logging](https://docs.cloud.google.com/logging/docs/structured-logging)

[2] [Google Cloud Logging — Configure notifications for log-based metrics](https://docs.cloud.google.com/logging/docs/logs-based-metrics/charts-and-alerts)
