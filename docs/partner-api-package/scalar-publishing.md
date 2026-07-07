# Scalar Publishing Notes

Scalar should read the OpenAPI contract from GitHub.

## Source URL

```text
https://raw.githubusercontent.com/softdabtech/vitaloop/main/docs/openapi/b2b-api.yaml
```

## Update Flow

1. Edit locally: `docs/openapi/b2b-api.yaml`.
2. Validate OpenAPI.
3. Commit and push to GitHub.
4. Scalar updates the API reference from the GitHub/raw URL or Git sync.

## Recommended Scalar Positioning

Title:

```text
VITALOOP B2B Analyze Labs API
```

Short description:

```text
Send parsed blood test biomarkers to VITALOOP and receive structured analysis JSON: health summary, prioritized biomarkers, risks, recommendations, protocol, retest suggestions, and disclaimer.
```

Partner note:

```text
Do not send partner_id. VITALOOP resolves tenant identity from X-Partner-Api-Key.
```

Security note:

```text
Never paste production API keys into public docs, screenshots, tickets, or shared recordings.
```
