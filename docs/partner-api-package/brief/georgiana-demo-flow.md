# Georgiana Demo Flow

## Message

VITALOOP can act as a blood-analysis API provider behind Georgiana's platform.

Her users stay inside her product. Her platform sends parsed biomarker JSON to VITALOOP. VITALOOP returns structured analysis that her platform can display in its own UX.

## Simple Diagram

```mermaid
sequenceDiagram
  participant User as User in Georgiana's platform
  participant Georgiana as Georgiana platform
  participant Vitaloop as VITALOOP API
  participant Core as VITALOOP analysis core

  User->>Georgiana: Uploads or enters lab results
  Georgiana->>Vitaloop: POST /v1/b2b/analyze-labs
  Vitaloop->>Core: Normalize biomarkers + run rules/AI
  Core-->>Vitaloop: Structured analysis
  Vitaloop-->>Georgiana: JSON response
  Georgiana-->>User: Displays health summary, flags, protocol, retest plan
```

## What To Show

1. Georgiana platform sends:
   - `external_user_id`
   - biomarkers JSON
   - optional symptoms/questionnaire

2. VITALOOP returns:
   - health summary
   - prioritized biomarkers
   - risks/flags
   - protocol
   - retest suggestions
   - doctor summary
   - disclaimer

3. Georgiana keeps control of:
   - user account
   - frontend UX
   - billing relationship
   - product journey

4. VITALOOP provides:
   - analysis engine
   - knowledge/rules layer
   - structured clinical decision-support JSON
   - API security, idempotency, audit, rate limiting

## Demo Script

"Your platform remains the user-facing product. VITALOOP runs behind the scenes as an analysis API. You send us parsed blood test data, and we return structured insights your platform can render directly: summary, abnormal biomarkers, risks, protocol, retest plan, and disclaimer."

## Pilot Ask

- Agree on one test data format.
- Create one staging API key.
- Run 5 smoke tests.
- Render the returned JSON in Georgiana's product prototype.
