# AyuSetu Symptom Recommendation Engine

This document explains how health recommendations are generated internally, what was improved, and why the current design is safer for production use.

## 1) What the engine does

The symptom engine converts user symptom input into:

- dosha imbalance estimate
- severity level (`mild | moderate | severe`)
- urgency (`LOW | MEDIUM | HIGH`)
- recommended specialty
- ranked recommendations (home support, optional herbal guidance, urgent action)
- risk score and confidence score
- red-flag detection output

Primary implementation:

- [recommendationEngine.js](../../backend/services/recommendationEngine.js)
- [aiService.js](../../backend/services/aiService.js)
- [rules.json](../../backend/config/rules.json)

## 2) Previous flaws and fixes

### Flaw A: Incomplete symptom rule coverage
- Problem: UI offered symptoms like `insomnia`, `skin_rash` but backend rules did not map them.
- Fix: Added complete rules for these symptoms in [rules.json](../../backend/config/rules.json).

### Flaw B: Oversimplified scoring
- Problem: severity was mostly summed from fixed values; no duration/lifestyle impact.
- Fix: Added weighted scoring using:
  - severity multiplier
  - duration multiplier
  - lifestyle risk factors
  - unknown symptom uncertainty penalty
  - multi-symptom complexity boost

### Flaw C: Weak safety escalation
- Problem: No robust emergency-style red-flag detection.
- Fix: Added critical red-flag patterns (chest pain, breathlessness, neuro signs, severe bleeding, high fever, seizure/fainting, self-harm terms). These force `HIGH` urgency and immediate-care hints.

### Flaw D: Inconsistent symptom naming
- Problem: symptom aliases could be fragmented (`head pain`, `migraine`, etc.).
- Fix: Added canonical symptom normalization and alias map.

### Flaw E: Low observability of model confidence
- Problem: no reliability signal for clinicians/users.
- Fix: Added:
  - `confidenceScore` (0-1)
  - `riskScore` (0-100)
  - `normalizedSymptoms` and `unknownSymptoms`

## 3) Input model used by engine

Each symptom item supports:

- `name` (required)
- `severity` (1-3)
- `durationDays` (optional, 0-3650)
- `notes` (optional)

Validated in:
- [symptoms.js](../../backend/routes/symptoms.js)

Collected from UI:
- [SymptomInput.jsx](../../frontend/src/pages/SymptomInput.jsx)

### 3.1 Symptom selection UX algorithm (patient-side)

To help patients choose symptoms accurately, the UI now applies a structured selection pipeline:

1. Category filter:
   - symptoms are grouped into `Pain`, `Digestive`, `Respiratory`, `General`, `Energy`, `Mind`, `Sleep`, `Skin`
2. Search filter:
   - patient can type plain words (`fever`, `throat`, `pain`) to reduce cognitive load
3. Catalog match:
   - each card contains `id`, human `label`, `icon`, and helper `tags`
4. Custom symptom capture:
   - if symptom is not listed, patient adds free-text issue
   - input is normalized into a canonical id (`custom_<normalized_text>`)
5. Structured enrichment:
   - each chosen symptom gets severity + duration + optional notes before submission

This prevents the old problem where patients had to fit into a tiny fixed list and improves real-world symptom capture quality.

### 3.2 Current supported symptom catalog

Mapped symptoms currently include:

- headache
- joint pain
- back pain
- indigestion
- stomach pain
- nausea
- constipation
- loose motion / diarrhea
- cold / cough
- sore throat
- fever
- fatigue
- anxiety
- insomnia
- skin rash

Any other symptom can still be submitted through the custom input path and is triaged conservatively.

## 4) Algorithm details

### 4.1 Normalization

1. Canonicalize symptom names:
   - lowercase + trim + underscore format
   - alias mapping (example: `head pain` -> `headache`)
2. Clamp:
   - severity in `[1,3]`
   - duration in `[0,3650]`

### 4.2 Risk contribution per symptom

For mapped symptoms:

1. Read base rule score from `rules.json` by severity tier.
2. Apply multipliers:
   - severity weight:
     - mild `1.0`
     - moderate `1.75`
     - severe `2.6`
   - duration multiplier:
     - `<=3d` -> `1.0`
     - `4-14d` -> `1.2`
     - `15-30d` -> `1.35`
     - `>30d` -> `1.5`
3. Priority score:
   - `priority = baseRuleScore * severityWeight * durationMultiplier`

For unmapped symptoms:

- add fallback recommendation with lower confidence
- include in `unknownSymptoms`

### 4.3 Lifestyle risk modifiers

Lifestyle text is scanned for risk signals:

- high stress
- poor sleep
- irregular meals
- dehydration
- sedentary pattern
- tobacco use
- alcohol excess

Each adds a small risk boost to the final aggregate score.

### 4.4 Red-flag safety layer

The engine scans symptom notes + lifestyle text for critical patterns:

- chest pain
- shortness of breath / breathing difficulty
- neuro deficit indicators (slurred speech, one-sided weakness, confusion)
- severe bleeding indicators
- high fever markers
- seizure/fainting
- self-harm ideation text

If detected:

- `requiresImmediateCare = true`
- `urgency = HIGH` (forced)
- red-flag metadata returned for UI/clinical review

### 4.5 Dosha scoring and specialty recommendation

1. For each recognized symptom, split mapped dosha components and accumulate weighted dosha scores.
2. Rank dosha totals.
3. Build final `doshaImbalance`:
   - one dosha if dominant
   - two-dosha combination if second dosha is close enough.
4. Map dosha imbalance to recommended specialty (fallback: `Kayachikitsa`).
5. If urgency is `HIGH`, keep recommendation conservative and routed to clinical review quickly.

### 4.6 Severity and urgency classification

Aggregate risk is normalized to `riskScore` (0-100), then:

- severe if high score or multiple severe symptoms
- moderate if medium score or one severe symptom
- mild otherwise

Urgency:

- `HIGH` when severe or red-flagged
- `MEDIUM` for moderate
- `LOW` for mild

### 4.7 Confidence scoring

`confidenceScore` is based on:

- proportion of mapped symptoms (known ratio)
- input richness (duration/notes/lifestyle completeness)

This discourages overconfidence for sparse or noisy inputs.

### 4.8 Unknown symptom handling

Custom/free-text symptoms are expected in production. For any symptom without a mapped clinical rule:

- mark as `unknownSymptoms`
- return conservative recommendation with lower confidence
- add global advice for clinician review
- include symptom in persisted assessment history for future model/rules expansion

This lets users report real symptoms without breaking the pipeline, while keeping safety-first output.

## 5) Response contract (important fields)

Engine returns:

- `doshaImbalance`
- `severityLevel`
- `urgency`
- `recommendedSpecialty`
- `recommendations[]` (sorted by score)
- `unknownSymptoms[]`
- `likelyCauses[]`
- `riskScore`
- `confidenceScore`
- `globalAdvice[]`
- `redFlags[]`
- `requiresImmediateCare`
- `normalizedSymptoms[]`
- `disclaimer`

## 6) Production safety principles applied

- No final diagnosis claims
- Explicit emergency escalation signals
- Conservative handling for unknown symptom patterns
- Ranked outputs with confidence and uncertainty
- Structured validation at route boundary
- Readable deterministic logic (auditable by clinical/product teams)

## 7) Pseudocode summary

```text
normalize input -> canonical symptoms
for each symptom:
  clamp severity + duration
  if mapped rule:
    compute weighted priority score
    accumulate dosha score
    build recommendation
  else:
    add unknown fallback recommendation

detect lifestyle risk
detect critical red flags
aggregate risk score + normalize
derive severity + urgency (red flags force HIGH)
rank dosha and map specialty
compute confidence from known ratio + richness
return structured triage payload
```

## 8) Operational recommendations

For best clinical quality over time:

1. Add telemetry on:
   - symptom distributions
   - false-positive urgency rate
   - doctor override rates
2. Build a clinician feedback loop to update `rules.json`.
3. Add multilingual symptom alias expansion from real usage logs.
4. Add unit tests for:
   - red-flag detection
   - severity boundary thresholds
   - normalization and scoring stability.
