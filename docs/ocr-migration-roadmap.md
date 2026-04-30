# OCR Migration Roadmap (Core Feature)

## Goal

Deliver production-grade lab report OCR for PDFs/images with resilient fallback and measurable quality.

## Target Stack

1. PaddleOCR (primary, document/table oriented)
2. Surya OCR (secondary fallback for hard layouts)
3. Tesseract (tertiary fallback safety net)
4. Optional LLM post-processor for structure recovery only (never source of truth for numeric values)

## Quality Bar

- Extraction success rate on production-like test set: >= 98%
- Critical field accuracy (name/value/unit/ref range): >= 99% on curated benchmark
- Median OCR latency for 1-page report: <= 3.5s
- Zero silent fake data injection on OCR failure

## Phases

### Phase 1 (started)

- Introduce provider-based OCR architecture with configurable primary engine and fallback chain.
- Keep API contract stable for frontend/backends.
- Disable mock text fallback by default in production path.

Deliverables:
- OCR provider abstraction
- Runtime selection env vars
- Safe fallback chain with logging

### Phase 2

- Add PaddleOCR provider package and model warmup.
- Add report/table preprocessing profile for CBC/CMP style reports.
- Add benchmark harness with labeled fixtures.

Deliverables:
- PaddleOCR in production fallback chain
- OCR benchmark report (accuracy + latency)

### Phase 3

- Integrate Surya provider as second fallback.
- Add confidence scoring + engine routing by document profile.
- Add automatic retries with alternative preprocess strategy.

Deliverables:
- Dynamic routing and confidence-aware fallback
- Reduced failure rate on noisy scans

### Phase 4

- Add strict post-OCR normalization layer:
  - biomarker alias mapping
  - unit normalization
  - reference-range parser with validation
- Add anomaly detection to reject malformed outputs before medical parsing.

Deliverables:
- Structured OCR output quality gate
- Safer downstream biomarker parsing

### Phase 5

- Add optional LLM structure recovery for low-confidence outputs.
- Keep deterministic validation mandatory for numeric fields.
- Add canary release and auto rollback triggers.

Deliverables:
- Controlled LLM assist path
- Production canary + SLO alerts

## Runtime Configuration

- OCR_PROVIDER: primary engine name (`tesseract`, `paddle`, `surya`)
- OCR_FALLBACK_CHAIN: comma-separated fallback engines
- OCR_ENABLE_MOCK_FALLBACK: keep `false` in production

## Rollout Strategy

1. Canary 10% traffic with telemetry.
2. Compare against baseline extraction quality.
3. Roll out 25% -> 50% -> 100% with rollback checkpoints.

## Current Status

- Phase 1 implemented.
- Phase 2 started: quality-aware engine routing and benchmark harness implemented.
- Paddle canary routing implemented in service runtime (via `OCR_CANARY_PERCENT`).
- Next step: install Paddle runtime on production host and run comparative benchmark.
