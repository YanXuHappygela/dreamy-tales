#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-dreamytales-498114}"
SERVICE="${SERVICE:-dreamy-tales-api}"
METRIC_NAME="dreamy_tales_daily_limit_hits"
POLICY_FILE="$(dirname "$0")/daily-limit-repeat-alert-policy.json"

gcloud logging metrics describe "$METRIC_NAME" --project="$PROJECT_ID" >/dev/null 2>&1 || \
  gcloud logging metrics create "$METRIC_NAME" \
    --project="$PROJECT_ID" \
    --description="Counts Dreamy Tales anonymous daily-limit hits." \
    --log-filter="resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${SERVICE}\" AND jsonPayload.event=\"daily_limit_reached\""

gcloud monitoring policies create --project="$PROJECT_ID" --policy-from-file="$POLICY_FILE"
echo "Created ${METRIC_NAME} and the repeated daily-limit alert policy."
