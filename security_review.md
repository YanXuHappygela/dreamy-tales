# Dreamy Tales App-to-Server Security Review

## Scope and Assessment

This is a focused code-and-deployment review of the mobile tRPC client, public Cloud Run API, Cloud SQL daily counter, Gemini and Google Text-to-Speech integrations. It is not a penetration test. The production dependency audit was attempted but the registry request stalled, so no claim is made about dependency advisory status.

The app has positive controls: stories and audio remain on-device, the database password comes from Secret Manager, Cloud Run uses a dedicated runtime identity, and story inputs have Zod validation. The principal residual issue is that public endpoints can spend the project’s Gemini and Google TTS quota.

## Prioritized Risk Register

| Priority | Risk and evidence | Impact | Proposed fix |
|---|---|---|---|
| **P0** | `story.generate`, `tts.synthesize`, and `tts.listVoices` are `publicProcedure`; Cloud Run was deployed with `--allow-unauthenticated`. | Direct callers can consume paid AI/TTS capacity and affect availability. | Place the API behind an external HTTPS load balancer and Cloud Armor; apply route-aware throttles to generation and synthesis. Add short-window app-level limits and safe Cloud Run max-instance/concurrency ceilings. [1] [2] |
| **P0** | The daily quota takes the first `X-Forwarded-For` value directly from a request. | A caller can forge/rotate the header to evade the 50-story limit. | Use Cloud Armor IP/XFF rate keys behind a controlled proxy. Do not trust caller-supplied forwarding headers; add a signed anonymous device/session token or app-attestation signal for stronger quotas. [2] |
| **P0** | The runtime database account was observed to hold `cloudsqlsuperuser` in addition to its required table grant. | A stolen runtime credential has unnecessary database power. | Revoke `cloudsqlsuperuser` from `dreamy_tales@''`. Retain only `SELECT`, `INSERT`, and `UPDATE` on `dreamy_tales.anonymous_story_usage`; use a separate admin identity for migrations. |
| **P1** | Server CORS reflects every `Origin` and enables credentials. | A hostile website may make credentialed browser calls if any cookie route is active now or later. | Use an explicit allowlist of approved web origins, add `Vary: Origin`, and omit credentialed CORS for native-only API use. |
| **P1** | Public `run.app` ingress can bypass future gateway or load-balancer security. | Edge protections may not cover direct traffic. | Set Cloud Run ingress to `internal-and-cloud-load-balancing` behind a load balancer/API gateway and disable the default URL where appropriate. [1] |
| **P1** | Express accepts 50 MB bodies; public TTS returns base64 MP3. | Memory, bandwidth, and paid-TTS denial-of-service pressure. | Lower body limits to the smallest usable value, cap tRPC batches and concurrent synthesis, set response-size limits, and set Cloud Run max instances to a spend-safe cap. |
| **P1** | API errors recently exposed database/query diagnostics. | Implementation detail assists attackers. | Log full errors server-side with a request ID; return a generic stable error to the app. Remove the temporary counter diagnostic details before the next production revision. |
| **P1** | Child name and caregiver story idea are put into prompts sent to external AI/TTS services. | Unnecessary disclosure of children’s personal information. | Make names optional/pseudonymous, never send contact details, preserve local-only history/audio, publish an age-appropriate privacy notice, and configure provider governance/retention settings. |
| **P2** | No standard response-hardening headers are configured. | Reduced browser protection against framing, MIME sniffing, and referrer leakage. | Add `helmet` with a reviewed CSP; set `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `frame-ancestors 'none'` unless embedding is required. |
| **P2** | Residual OAuth/session helpers log URLs, headers, cookies, and token prefixes in `lib/_core/api.ts`. | Debug logs can expose session metadata; unused code expands maintenance surface. | Remove unused auth helpers or guard diagnostics to development only; redact tokens, cookies, authorization headers, and query strings. |
| **P2** | Child-safety relies primarily on the generation prompt. | A model failure can return age-inappropriate content. | Add server-side post-generation schema checks, prohibited-theme detection, moderation/safety classification, regeneration, and a safe fallback story. |

## Recommended Sequence

| Timeframe | Action | Success condition |
|---|---|---|
| **Immediately** | Revoke `cloudsqlsuperuser`; remove database details from public errors. | Story generation works and `SHOW GRANTS` only shows narrow table access. |
| **1–3 days** | CORS allowlist, reduced request limits, batch caps, per-minute generation/TTS limits. | Unapproved origins and oversized/burst requests fail predictably. |
| **1–2 weeks** | Load balancer/API gateway plus Cloud Armor; restrict direct Cloud Run ingress. | Direct `run.app` traffic is blocked or requires the intended protected path. |
| **Before wider child release** | App attestation/signed anonymous sessions, output safety validation, spend/error alerts, privacy review. | Automated abuse/safety tests and operational alerts are in place. |

> A static key shipped in an Expo client is not a security boundary. Treat the phone as an untrusted public client and enforce authorization, quota, and spend controls at the server or edge.

## References

[1] [Google Cloud Run — Security design overview](https://docs.cloud.google.com/run/docs/securing/security)

[2] [Google Cloud Armor — Rate limiting overview](https://docs.cloud.google.com/armor/docs/rate-limiting-overview)
