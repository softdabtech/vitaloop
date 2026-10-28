# VITALOOP Landing Copy Strategy: Symptom-First Health Loop

Дата: 2026-05-27

Цель документа: подготовить текстовое ТЗ для обновления публичного сайта VITALOOP под новую продуктовую стратегию.

Новая стратегия: VITALOOP должен продаваться не только как AI-интерпретатор анализов, а как система, которая помогает пользователю начать с состояния или симптома, понять какие факторы стоит проверить, получить план анализов и врачебных направлений, затем загрузить результаты и вести адаптивный протокол улучшения.

Важно: не позиционировать продукт как диагностику или замену врачу. Формулировки должны быть в зоне wellness / health intelligence / decision support:

- helps identify possible contributing factors
- suggests labs to discuss or order
- flags when medical review may be important
- turns symptoms and lab data into a structured action loop

## Master Prompt For Copy Updates

Use this prompt when rewriting landing/public pages:

> Rewrite VITALOOP public website copy from a lab-upload-only positioning to a symptom-informed health intelligence positioning.
>
> Product promise: VITALOOP helps people start with how they feel, answer smart follow-up questions, identify possible contributing factors, choose useful lab tests to discuss/order, understand which doctor direction may be relevant, upload lab results, and follow a personalized protocol with weekly check-ins and retests.
>
> Tone: clear, practical, health-aware, non-alarmist, not hype-heavy.
>
> Avoid: diagnosis claims, guaranteed outcomes, "cure", "treatment", "replace doctor", unsupported clinical accuracy claims, unsupported statistics.
>
> Use: "possible causes", "contributing factors", "lab plan", "doctor direction", "discuss with a qualified clinician", "wellness tool", "not a medical device".
>
> Keep current strengths: AI lab analysis, 85+ biomarkers, prioritized protocol, weekly check-ins, longitudinal tracking, privacy-first design.

## New Core Positioning

### Current Core Promise

Upload lab PDF -> AI analysis -> personalized protocol -> weekly tracking.

### New Core Promise

Tell VITALOOP what you feel -> answer smart questions -> get a lab and doctor direction plan -> upload results -> follow an adaptive improvement protocol.

### Short Tagline Options

Primary:

> From symptoms to smarter labs to a plan you can follow.

Alternatives:

> Start with how you feel. VITALOOP helps you decide what to check next.

> Your health loop: symptoms, labs, protocol, progress.

> Stop guessing what to test. Turn symptoms into a structured next step.

## Global Navigation

Files:

- `frontend/src/pages/Landing.jsx`
- `frontend/src/components/landing/PageHeader.jsx`
- `frontend/src/components/landing/Footer.jsx`

Recommended nav labels:

- Features -> How it helps
- Pricing -> Pricing
- About -> About
- For Nutritionists -> For Practitioners

Add if space allows:

- Symptom Check

CTA labels:

- Replace "Upload Lab PDF (Free)" with "Start with symptoms"
- Secondary CTA: "Upload labs"

## Home Page: Landing.jsx

### SEO

Current:

> Interpret Blood Test Results with AI | VITALOOP

Replace with:

> Symptom-Informed Lab Guidance & AI Health Protocols | VITALOOP

Current description:

> Analyze blood test results with comprehensive AI review. Upload your lab PDF, see prioritized biomarkers, and start a personalized weekly protocol for free.

Replace with:

> Start with symptoms or lab results. VITALOOP helps you understand possible contributing factors, choose useful labs, upload results, and follow a personalized protocol with weekly check-ins.

### Hero

Current headline:

> Spent $400 on blood tests. Don't know what to do?

Replace with:

> Feel off, but don't know what to check?

Current body:

> Upload your PDF. Get a comprehensive protocol with dosages.Not interpretation. Execution.Stop wasting time decoding lab results. Get a personalized action plan ranked by priority, with exact supplement dosages, meal timing, and weekly milestones to track real progress.

Replace with:

> Tell VITALOOP what you feel, answer smart follow-up questions, and get a clear next-step plan: which labs may matter, which doctor direction may be relevant, and how to turn results into an action protocol.

CTA:

- Primary: `Start with symptoms`
- Secondary: `Upload lab results`

Hero trust signals:

Current:

- Clinical-grade interpretation
- Privacy-first architecture
- Comprehensive evidence review

Replace with:

- Symptom-informed intake: `Smart follow-up questions turn vague symptoms into structured context.`
- Lab guidance: `Get a practical list of biomarkers to check and why they matter.`
- Adaptive protocol loop: `Upload results, follow weekly actions, and track how you feel over time.`

### Top Stats / Value Chips

Current stats are too finance/conversion oriented in some places.

Replace with:

- `Symptoms -> labs`: Smart intake before testing
- `85+ biomarkers`: Normalized after upload
- `Weekly loop`: Check-ins connect symptoms to progress
- `Privacy-first`: Your health context stays protected

Avoid:

- Free-to-paid conversion
- Guaranteed before/after outcomes unless verified
- "Clinical-grade" unless backed by compliance/clinical validation

### Doctor vs VITALOOP Section

Current section:

> Your Doctor vs VITALOOP
> What they say vs what you actually need

Problem: too adversarial.

Replace headline:

> What your appointment often misses between visits

Replace intro:

> VITALOOP is not a replacement for medical care. It helps you organize symptoms, lab data, and weekly progress so you can make better use of clinician time and avoid guessing between appointments.

Left column title:

> Typical health data experience

Left items:

- Symptoms are described once and forgotten
- Lab PDFs show numbers without next steps
- You decide alone what to test next

Right column title:

> VITALOOP loop

Right items:

- Symptoms are captured as structured context
- Labs are prioritized by possible relevance
- Protocol and check-ins track what changes

### How It Works Section

Current headline:

> From PDF to personalized protocol in 4 steps

Replace with:

> From symptoms to labs to a protocol in 5 steps

Current subheading:

> Upload your lab report, get AI analysis, execute protocol, track weekly progress

Replace with:

> Start with how you feel, get a lab plan, upload results, and keep improving with weekly feedback.

Steps:

1. `Describe what you feel`
   Body: `Start with symptoms, goals, medications, supplements, and what you have already tried.`

2. `Answer smart follow-ups`
   Body: `VITALOOP asks focused questions and flags when medical review may be important.`

3. `Get a lab direction plan`
   Body: `See which biomarkers may be useful to check, why they matter, and which clinician direction could fit.`

4. `Upload lab results`
   Body: `VITALOOP analyzes 85+ biomarkers and connects results back to your symptoms and goals.`

5. `Follow and adapt`
   Body: `Run a protocol, complete weekly check-ins, and retest when the data says it is time.`

### Premium Features

Current:

- Biomarker Timeline
- AI Protocol
- Weekly Check-ins
- Unlimited Uploads & Retests

Replace/extend:

- `Symptom Intake & Smart Follow-ups`
  `Turn vague complaints into structured context before you decide what to test.`

- `Lab Direction Plan`
  `Get a prioritized list of biomarkers to check and questions to discuss with a clinician.`

- `AI Protocol`
  `After upload, receive supplement, nutrition, lifestyle, and retest actions tied to your results.`

- `Weekly Check-ins`
  `Track symptom changes, adherence, side effects, and progress between lab cycles.`

- `Biomarker Timeline`
  `Compare retests and see whether symptoms and markers move together.`

### Feedback Loop Section

Current:

> The Feedback Loop: One Test is a Snapshot. Three is a System.

Replace with:

> The Health Loop: Symptoms explain the labs. Labs guide the plan.

Body:

> A symptom without labs is a clue. A lab result without symptom context is incomplete. VITALOOP connects both into a repeatable loop: describe what you feel -> check useful markers -> upload results -> run a protocol -> track weekly response -> retest with context.

### Health Intelligence Hub

Current body:

> Deep dives on reading blood test results, optimizing ferritin, testosterone, cortisol, and building a sustainable biohacking protocol.

Replace with:

> Guides on connecting symptoms, biomarkers, and next steps: what to check when energy drops, sleep worsens, recovery stalls, digestion changes, or inflammation patterns appear.

Guide cards:

- `How to connect symptoms with biomarkers`
  `Why fatigue, pain, sleep issues, and brain fog often need context before choosing labs.`

- `Which labs to check first`
  `How to build a practical first-pass lab plan without ordering everything.`

- `From results to a protocol`
  `How VITALOOP turns flagged markers into nutrition, supplements, lifestyle actions, and retest timing.`

### Final CTA

Current:

> Start Interpreting Your Blood Tests With AI Today

Replace with:

> Start with what you feel today

Body:

> Describe your symptoms or upload existing lab results. VITALOOP helps you move from uncertainty to a structured next step.

CTA:

- Primary: `Start symptom check`
- Secondary: `Upload labs`

## FAQ On Home Page / AnimatedFAQ / FAQ Schema

Files:

- `frontend/src/pages/Landing.jsx`
- `frontend/src/components/landing/AnimatedFAQ.jsx`
- `frontend/src/pages/FAQ.jsx`

Replace or add these FAQ items.

### What can I do if I have symptoms but no lab results yet?

> You can start with a symptom check. VITALOOP asks focused follow-up questions, organizes your health context, and suggests which labs or doctor direction may be useful to consider. It does not diagnose conditions or replace medical care.

### Does VITALOOP diagnose my symptoms?

> No. VITALOOP is a wellness and health intelligence tool, not a diagnostic device. It can highlight possible contributing factors, red-flag situations that deserve medical review, and lab markers that may help clarify the picture.

### Which symptoms can I enter?

> You can describe concerns such as fatigue, poor sleep, brain fog, digestive issues, muscle pain, joint discomfort, recovery problems, mood changes, or a specific concern like leg pain. If your symptoms suggest urgency, VITALOOP will recommend seeking qualified medical care.

### How does VITALOOP choose recommended labs?

> VITALOOP uses your symptoms, goals, health history, supplements, medications, and prior results to suggest biomarker categories that may be relevant. Final decisions about testing should be made with a qualified clinician or licensed lab provider.

### What happens after I upload lab results?

> VITALOOP analyzes your biomarkers, connects them to your symptom context where relevant, ranks priorities, and generates a protocol with supplements, nutrition actions, lifestyle steps, and retest timing.

### Is VITALOOP a replacement for a doctor?

> No. VITALOOP helps organize symptoms, labs, and progress so you can make better decisions and have more productive conversations with healthcare professionals.

## Features Page

File: `frontend/src/pages/Features.jsx`

### SEO

Current:

> Explore VITALOOP's powerful features: AI biomarker analysis, longitudinal tracking, smart protocols, and AI health coaching.

Replace with:

> Explore VITALOOP features for symptom intake, lab guidance, AI biomarker analysis, personalized protocols, weekly check-ins, and practitioner collaboration.

### Hero

Current headline:

> Everything You Need to Master Your Health

Replace with:

> Everything you need to turn symptoms and labs into action

Current body:

> From automated lab analysis to AI coaching and doctor collaboration. All the tools to understand and optimize your biomarkers.

Replace with:

> Start with what you feel, understand what to check, upload results, and follow an adaptive protocol that keeps symptoms and biomarkers connected over time.

### Feature Cards

Add these cards near the top:

1. `Symptom Intake`
   `Describe what you feel in plain language. VITALOOP turns it into structured context with duration, severity, triggers, related symptoms, and what you have already tried.`
   Details: `Smart follow-ups`, `Severity and duration`, `Medication/supplement context`, `Red-flag guidance`

2. `Lab Direction Plan`
   `Before you order random tests, get a practical list of biomarkers that may help clarify your concern and why each one matters.`
   Details: `Suggested biomarker categories`, `Reason for each lab`, `Doctor direction`, `Retest timing`

Revise existing:

- `AI Biomarker Analysis`
  Replace description with:
  `Analyze 85+ biomarkers from your lab report and connect flagged results back to symptoms, goals, and prior health context.`

- `Smart Protocol Engine`
  Replace description with:
  `Get supplement, nutrition, lifestyle, and retest recommendations ranked by priority after symptoms and lab results are reviewed together.`

- `AI Health Coaching`
  Replace description with:
  `Ask guided questions about symptoms, biomarkers, and protocol next steps. VITALOOP explains context without replacing a clinician.`

- `Doctor Sharing`
  Replace title with `Clinician-ready sharing`
  Replace description with:
  `Share symptom history, lab priorities, results, and protocol progress with a qualified professional when you need review.`

Remove or soften:

- `Risk assessment` -> `Pattern context`
- `HIPAA-compliant` unless legally verified. Use `privacy-first safeguards`.
- `PDF & image analysis` if current canonical product copy should remain PDF-only.

## How It Works Page

File: `frontend/src/pages/HowItWorks.jsx`

### SEO

Current:

> How AI Blood Test Analysis Works | VITALOOP

Replace with:

> How Symptom-Informed Lab Guidance Works | VITALOOP

Description:

> See how VITALOOP starts with symptoms or lab results, suggests useful labs to consider, analyzes biomarkers, and turns results into an adaptive health protocol.

### Hero

Current headline:

> Explore how the system actually works

Replace with:

> How VITALOOP turns symptoms into a smarter health loop

Current body:

> This page is the bridge between marketing and product reality: how uploads become insight, how insight becomes action, and how repeated lab cycles create a smarter protocol over time.

Replace with:

> Start with how you feel or upload existing labs. VITALOOP structures your symptoms, suggests what to check next, analyzes results, and keeps the plan adaptive through weekly check-ins and retests.

### Steps

Replace current 4-step flow with:

1. `Describe your concern`
   `Tell VITALOOP what is happening: symptoms, duration, severity, triggers, medications, supplements, and goals.`

2. `Answer focused follow-ups`
   `The system asks clarifying questions and highlights situations where qualified medical review should not wait.`

3. `Choose useful labs`
   `Get a practical biomarker plan that explains what each lab may clarify and which doctor direction may fit your case.`

4. `Upload results`
   `VITALOOP normalizes your report, reviews 85+ biomarkers, and connects results with your symptom context.`

5. `Run the feedback loop`
   `Follow a protocol, track weekly symptom changes, and retest with a clearer picture of what moved and what did not.`

### Schema HowTo

Replace schema steps to match the 5-step flow above.

## About Page

File: `frontend/src/pages/About.jsx`

### SEO

Replace description with:

> Learn why VITALOOP exists: to help people turn symptoms, lab results, and weekly progress into structured next steps without replacing medical care.

### Hero

Current:

> We're on a mission to make your health data work for you

Replace:

> We're on a mission to make symptoms and lab data work together

Current body:

> Vitaloop was built by people who were tired of spending hundreds on lab tests — and getting nothing actionable in return.

Replace:

> Vitaloop was built for the moment most people know something feels off, but do not know what to check, which results matter, or how to turn the answer into a plan.

CTA:

> Start symptom check

### Problem Stats

Replace:

- `$400 spent on blood tests` -> `Symptoms without a plan`
  `Most people wait, Google, or order random tests without a structured next step.`

- `7 minutes average doctor appointment` -> `Short appointments`
  `Clinician time is limited, so symptom history and lab context need to be organized before the visit.`

- `Millions of PDFs` -> `Lab PDFs without context`
  `Numbers alone rarely explain how someone feels or what should happen next.`

### Why We Built Vitaloop

Replace section body with:

> Most health journeys do not start with a PDF. They start with a feeling: fatigue that will not lift, sleep that stops restoring you, pain that keeps returning, digestion that changes, or recovery that suddenly slows.
>
> The old path is fragmented: search symptoms online, guess which labs to order, wait for results, then stare at numbers without a clear plan.
>
> We built VITALOOP to connect the loop: symptoms, smart questions, useful labs, biomarker analysis, protocol execution, weekly feedback, and retesting.

Replace quote:

> People do not need more disconnected health data. They need a clearer next step.

### Roadmap

Today:

> A symptom-informed AI health platform that helps users organize concerns, choose useful labs to consider, analyze 85+ biomarkers, and follow a personalized protocol.

Next 6 months:

> Deeper symptom-to-lab guidance, practitioner review workflows, and better tracking of how symptoms change across protocol cycles.

Vision:

> A world where people can move from "something feels wrong" to an informed, clinician-aware plan without guesswork.

## Example Report Page

File: `frontend/src/pages/ExampleReport.jsx`

### SEO

Current:

> Blood Test Analysis Example Report | VITALOOP

Replace:

> Symptom-to-Lab Example Report | VITALOOP

Description:

> Preview how VITALOOP connects a health concern, relevant lab markers, AI biomarker review, protocol actions, and weekly tracking.

### Hero

Current:

> See Your Health in 3D

Replace:

> See how one health concern becomes a structured plan

Body:

> This sample shows how VITALOOP connects symptoms, biomarker results, and protocol actions. Start with what you feel, then use lab data to make the plan more precise.

CTA:

- `Try symptom check`
- `See how it works`

### Feature Cards

Replace:

- `Interactive Zones` -> `Concern context`
  `See which body systems and biomarker groups may be relevant to a symptom or goal.`

- `Real-Time Data` -> `Lab-backed clarity`
  `Upload results to move from possible factors to concrete biomarker patterns.`

- `Smart Protocols` -> `Adaptive protocol`
  `Get actions tied to results, then track symptoms and adherence each week.`

### FAQ

Replace/add:

Question:

> Can I use VITALOOP before I have lab results?

Answer:

> Yes. You can start with symptoms or a health concern. VITALOOP helps structure your context and suggest labs or doctor directions to consider before you upload results.

Question:

> Does the example diagnose a condition?

Answer:

> No. The example shows how health context and biomarkers can be organized. Diagnosis and treatment decisions should be made with a qualified clinician.

## For Nutritionists / Practitioners Page

File: `frontend/src/pages/ForNutritionists.jsx`

### Page Naming

Recommended public label:

> For Practitioners

Keep URL for now if needed, but copy should include nutritionists, health coaches, functional practitioners, and clinicians.

### Hero / Value Proposition

Current practitioner positioning is lab/protocol workflow.

Add symptom-first value:

> Clients often arrive with scattered symptoms before they have clean lab data. VITALOOP helps you capture structured intake, prioritize useful labs, review results, and keep adherence visible between sessions.

### Pain Points

Replace/add:

- `Symptoms arrive as long messages`
  `Clients describe fatigue, pain, sleep issues, digestion, and mood in unstructured chat threads. It is hard to see patterns.`

- `Lab decisions are not standardized`
  `Different clients need different first-pass labs, but building a plan manually takes time.`

- `Follow-up context gets lost`
  `You need to know whether symptoms changed after the protocol, not just whether the client uploaded another PDF.`

### Workflow Steps

Replace with:

1. `Invite client`
   `Client completes symptom and goal intake before or after the first session.`

2. `Review symptom context`
   `See severity, duration, related symptoms, supplements, medications, and what they have tried.`

3. `Create lab direction`
   `Use VITALOOP to draft relevant biomarker categories and testing priorities.`

4. `Analyze uploaded labs`
   `Once results arrive, VITALOOP normalizes biomarkers and connects them to symptom context.`

5. `Monitor protocol response`
   `Weekly check-ins show adherence, symptom changes, and when retesting may be useful.`

### Practitioner FAQ Additions

Question:

> Can VITALOOP help before a client has lab results?

Answer:

> Yes. Clients can complete symptom and goal intake first. VITALOOP helps organize the case and suggest lab categories that may be worth discussing or ordering through your normal workflow.

Question:

> Does AI replace practitioner judgment?

Answer:

> No. VITALOOP drafts structure, priorities, and protocol suggestions. The practitioner remains responsible for review, decisions, and client care.

## Pricing Copy

Files:

- `frontend/src/components/landing/InteractivePricing.jsx`
- `frontend/src/pages/Pricing.jsx`

### Free Plan

Current:

> Test with your own labs

Replace:

> Start with one concern or first lab upload

Bullets:

- Symptom/health concern intake
- 1 active lab upload
- Basic biomarker summary
- Core dashboard

### Premium Plan

Current:

> Complete health management

Replace:

> Full symptom-to-lab feedback loop

Bullets:

- Unlimited uploads and retests
- Symptom-informed lab guidance
- Personalized AI protocol
- Weekly check-ins and adaptation
- Progress timeline

### Pro Premium / Practitioner

Current:

> Advanced tier with closed capabilities

Replace:

> Practitioner and advanced review workflows

Bullets:

- Multi-client symptom intake
- Lab and protocol review workflows
- Advanced protocol templates
- Direct specialist/practitioner review channel where available
- Priority rollout modules

## Help / FAQ Page

File: `frontend/src/pages/FAQ.jsx`

The current FAQ contains claims that need cleanup:

- `PNG/JPG images`, `HL7/FHIR`, and EMR support may be overstated.
- `HIPAA-compliant and SOC 2 certified` should be used only if legally verified.
- `3 uploads/year` conflicts with current canonical `1 active lab upload`.
- `Practitioner plan is $29/month` conflicts with current Pro Premium pricing.

Replace with canonical safer text:

### What can I do before I have labs?

> Start with a health concern. VITALOOP asks follow-up questions, organizes your context, and suggests labs or doctor directions to consider. It is not a diagnosis.

### What file formats do you accept?

> VITALOOP is optimized for standard lab PDF reports. If additional formats are enabled in your account, the upload screen will show them.

### What's the difference between Free and Premium?

> Free includes one active lab upload and core dashboard access. Premium includes unlimited uploads, symptom-informed guidance, AI protocols, weekly check-ins, and longitudinal tracking.

### Is my health data secure?

> VITALOOP uses privacy-first safeguards, encrypted transport, access controls, and strict data separation. Your health data is not sold to advertisers or data brokers.

### Is this medical advice?

> No. VITALOOP provides educational health intelligence and decision support. It does not diagnose, treat, or replace qualified medical care.

## Footer

File: `frontend/src/components/landing/Footer.jsx`

Current footer description:

> AI lab analysis, personalized protocols, and longitudinal biomarker tracking for people who want a repeatable health system instead of one-off interpretations.

Replace:

> Symptom-informed lab guidance, AI biomarker analysis, personalized protocols, and weekly tracking for people who want a repeatable health loop instead of guesswork.

Medical disclaimer:

Keep and strengthen:

> VITALOOP is a wellness and health intelligence tool, not a medical device. It does not diagnose, treat, or replace qualified medical care.

## Landing Copy Glossary Update

File: `frontend/src/components/landing/LANDING_COPY_GLOSSARY.md`

Recommended updates:

Core promise:

> symptoms -> lab direction -> biomarker analysis -> prioritized actions -> weekly feedback loop

Canonical feature phrases:

- "Start with symptoms"
- "Symptom-informed lab guidance"
- "Lab direction plan"
- "Upload your lab PDF"
- "Prioritized action plan"
- "Weekly check-ins on paid plans"
- "Longitudinal tracking"
- "Protocol adaptation"

Avoid:

- "diagnosis"
- "we detect disease"
- "replace your doctor"
- unsupported HIPAA/SOC2 claims
- guaranteed biomarker improvement timelines

## Copy Guardrails

Use:

- `may help clarify`
- `possible contributing factors`
- `doctor direction`
- `discuss with a qualified clinician`
- `health intelligence`
- `wellness tool`
- `structured next step`

Avoid:

- `diagnose`
- `treat`
- `cure`
- `clinical-grade` unless verified
- `guaranteed results`
- `doctor replacement`
- `exact cause of your symptom`

## Recommended Implementation Order

1. Update glossary first.
2. Update `Landing.jsx` hero, SEO, FAQ schema, how-it-works, feedback loop, final CTA.
3. Update `AnimatedFAQ.jsx` and `FAQ.jsx`.
4. Update `Features.jsx`.
5. Update `HowItWorks.jsx` and schema.
6. Update `About.jsx`.
7. Update `ExampleReport.jsx`.
8. Update `ForNutritionists.jsx` copy to "For Practitioners" positioning.
9. Update pricing copy.
10. Run visual QA on landing and public pages.

## Success Criteria

After copy update, a new visitor should understand:

1. They can start without existing lab results.
2. VITALOOP can intake symptoms and ask smart follow-up questions.
3. The product can suggest which labs may be useful and why.
4. The product is not diagnosing and not replacing doctors.
5. Uploading labs makes recommendations more precise.
6. Weekly check-ins connect actions back to how the user feels.
7. The service is a repeatable health loop, not a one-time PDF interpretation.
