export const GUIDES = [
  {
    slug: 'ferritin-in-context',
    title: 'How to read ferritin in context',
    description:
      'Why ferritin without CRP, iron saturation, symptoms, and trend direction is often misleading — and how to interpret the full picture.',
    category: 'Biomarker Interpretation',
    readTime: '7 min read',
    intro:
      'Ferritin is the body\'s primary iron storage protein, but it is also an acute-phase reactant — it rises during inflammation, infection, and metabolic stress regardless of actual iron status. This makes it one of the most frequently misinterpreted markers in routine blood panels. A single ferritin number without context can lead to both missed deficiency and unnecessary supplementation.',
    sections: [
      {
        heading: 'Why lab "normal" is not functional normal',
        body: 'Standard lab reference ranges for ferritin (typically 12–300 ng/mL for women, 12–400 ng/mL for men) are derived from population distributions, not from studies of where people feel and function optimally. Research on symptoms of iron deficiency consistently shows that fatigue, cold intolerance, hair shedding, impaired exercise recovery, and restless legs begin appearing at ferritin levels of 20–50 ng/mL — values that fall squarely inside the "normal" range on most lab reports. Functional medicine practitioners and performance-focused clinicians typically target ferritin above 50–70 ng/mL for women and above 70–100 ng/mL for men when symptom burden is present.',
        bullets: [
          'Ferritin 12–30 ng/mL: often insufficient for sustained energy, hair retention, and athletic recovery',
          'Ferritin 30–50 ng/mL: borderline — symptoms are the deciding factor',
          'Ferritin 50–100 ng/mL: generally adequate; individual variation applies',
          'Ferritin > 200 ng/mL: warrants investigation for inflammation, metabolic syndrome, or hemochromatosis',
        ],
      },
      {
        heading: 'The CRP problem: inflammation masks iron status',
        body: 'C-reactive protein (CRP) is produced by the liver in response to inflammation. Ferritin is too. When CRP is elevated — even mildly above 1 mg/L — ferritin rises independently of iron stores, creating a false picture of adequate or high iron. This is one of the most clinically important interpretation errors: a person with iron deficiency and active low-grade inflammation (from poor sleep, visceral adiposity, or a recent infection) may show a ferritin of 60–90 ng/mL while their actual iron stores are depleted.',
        bullets: [
          'Always read ferritin alongside high-sensitivity CRP (hs-CRP)',
          'If hs-CRP > 1 mg/L, ferritin may be artificially elevated by 15–40%',
          'In this scenario, iron saturation (transferrin saturation %) becomes the more reliable marker',
          'Retest ferritin after inflammation resolves for an accurate baseline',
        ],
      },
      {
        heading: 'Iron saturation: the second lens',
        body: 'Transferrin saturation (the percentage of transferrin carrying iron) reflects the functional iron supply in circulation rather than storage reserves. Normal range is 20–45%. A transferrin saturation below 20% is a strong signal of iron-limited erythropoiesis even when ferritin looks acceptable. Conversely, saturation above 45% alongside elevated ferritin points toward iron overload or excessive supplementation. Reading ferritin and transferrin saturation together catches cases that either marker alone misses.',
        bullets: [
          'Ferritin low + saturation low = classic iron deficiency, supplement indicated',
          'Ferritin normal + saturation low = functional deficiency masked by inflammation or early depletion',
          'Ferritin high + saturation high = potential iron overload, genetic screening (HFE gene) warranted',
          'Ferritin high + saturation normal = likely inflammatory elevation, not true iron excess',
        ],
      },
      {
        heading: 'Symptoms as a third signal',
        body: 'Biomarkers and symptoms are not independent — they are two representations of the same underlying physiology. When fatigue, cold extremities, increased hair shedding, poor exercise recovery, and restless legs cluster together, they correlate with low ferritin even when lab values are technically "normal." Treating the pattern rather than the isolated number often produces faster clinical response. The symptom burden score should always be documented alongside each lab panel so that changes can be tracked between retest cycles.',
        bullets: [
          'Track: fatigue, cold intolerance, resting heart rate, hair shed count, exercise recovery time',
          'Three or more symptoms with ferritin below 60 is usually sufficient to justify a therapeutic trial',
          'Symptom improvement at 6–8 weeks confirms that iron was the limiting factor',
          'No symptom improvement despite rising ferritin suggests another cause needs evaluation',
        ],
      },
      {
        heading: 'Trend direction matters more than a single value',
        body: 'A ferritin of 45 ng/mL is very different depending on whether it was 80 three months ago or 30. Trend velocity — the rate of change between consecutive readings — is often more actionable than the absolute value. A declining trend signals ongoing loss or inadequate intake that will become symptomatic before the next test. An ascending trend during supplementation confirms absorption and adequate dosing. VITALOOP plots trend direction across all uploaded panels so that direction is immediately visible alongside range context.',
        bullets: [
          'Declining ferritin > 30% over two panels warrants cause investigation (menstrual loss, GI bleeding, absorption issue)',
          'Stable ferritin below target during supplementation suggests dosing, form, or timing needs adjustment',
          'Rising ferritin confirms protocol efficacy — the rate of rise guides dose tapering',
        ],
      },
      {
        heading: 'High ferritin: what it can mean',
        body: 'Elevated ferritin is not simply "too much iron." The most common causes are non-alcoholic fatty liver disease (NAFLD), metabolic syndrome, alcohol use, chronic inflammation, and hereditary hemochromatosis — in that order. Genuinely high iron stores from hemochromatosis require specific follow-up (transferrin saturation > 45%, genetic HFE testing). Most elevated ferritin without elevated saturation reflects metabolic inflammation and responds to lifestyle correction rather than iron removal.',
        bullets: [
          'Ferritin > 200 (women) or > 300 (men): check hs-CRP, liver enzymes, transferrin saturation',
          'Ferritin > 400 with saturation > 45%: genetic hemochromatosis workup required',
          'Ferritin high + metabolic markers elevated (glucose, triglycerides, ALT): address metabolic health first',
          'Do not supplement iron when ferritin is elevated regardless of symptoms',
        ],
      },
    ],
    takeaways: [
      'Never interpret ferritin without hs-CRP — inflammation silently inflates the number',
      'Functional sufficiency starts around 50–70 ng/mL for most people, not the lab lower limit',
      'Pair ferritin with transferrin saturation for the complete iron status picture',
      'Symptoms and trend direction are not optional context — they are the clinical interpretation',
      'High ferritin usually reflects metabolic inflammation, not iron excess',
    ],
  },

  {
    slug: 'retest-loop',
    title: 'Building a repeatable retest loop',
    description:
      'How to time uploads, check-ins, and protocol changes so progress is measurable rather than anecdotal — and your lab data compounds over time.',
    category: 'Protocol Design',
    readTime: '6 min read',
    intro:
      'Most people get a blood test, receive results, adjust something — or nothing — and then do not test again for 12–18 months. This is a one-shot feedback system. Interventions cannot be measured, causes cannot be isolated, and the next panel starts from scratch without any baseline for comparison. Building a repeatable loop transforms a passive measurement into an active feedback system where each cycle makes the next one sharper.',
    sections: [
      {
        heading: 'The 8–12 week biological window',
        body: 'Biomarkers do not change overnight. Most nutritional and lifestyle interventions require a minimum of 8 weeks to produce measurable changes in blood markers. This is not a product limitation — it reflects the biology of cellular turnover, tissue remodeling, and enzyme upregulation. Vitamin D serum levels equilibrate over 6–8 weeks of consistent supplementation. Ferritin replenishment with iron supplementation typically takes 10–14 weeks. HbA1c reflects average blood glucose over 90 days. Retesting before these windows produces noise rather than signal, and retesting too late (beyond 6 months) breaks the feedback chain.',
        bullets: [
          'Vitamin D equilibration: 6–8 weeks at stable dosing',
          'Ferritin repletion: 10–14 weeks with consistent iron supplementation',
          'HbA1c change: 90-day window by definition',
          'Thyroid marker response to lifestyle: 8–10 weeks',
          'Omega-3 index: 8–12 weeks of consistent intake',
        ],
      },
      {
        heading: 'What to track between labs',
        body: 'Blood labs are lagging indicators — they confirm changes that happened weeks or months ago. To fill the gap, weekly symptom check-ins act as leading indicators. Consistent logging of energy level (1–10), sleep quality, exercise recovery, cold tolerance, mood, and any side effects from protocol changes gives you real-time signal between blood draws. When the 12-week retest arrives, the symptom trend tells you whether biomarker improvement is likely before you see the numbers — and if the numbers did not move, the symptom log explains why.',
        bullets: [
          'Log weekly: energy (1–10), sleep quality, exercise recovery, mood, adherence %',
          'Log as needed: side effects, dietary changes, stress events, illness',
          'Compare symptom trends to biomarker changes at each retest — this is your calibration loop',
          'Flat symptom scores with rising biomarkers confirm objective improvement that is not yet subjectively felt',
        ],
      },
      {
        heading: 'Protocol adherence is data, not a moral judgment',
        body: 'If ferritin did not rise after 12 weeks of iron supplementation, there are exactly two categories of explanation: execution or absorption. If adherence was 55%, the protocol was not actually tested — execution is the variable. If adherence was 92% and ferritin still did not rise, the dosing, form, timing, or a competing factor (calcium blocking iron absorption, PPI use reducing gastric acid, celiac disease impairing mucosal uptake) needs investigation. Logging adherence honestly makes this distinction possible. Without it, protocol iteration is guesswork.',
        bullets: [
          '> 90% adherence with no biomarker response: investigate form, dose, timing, or competing factors',
          '50–75% adherence with no response: execution needs to be solved before the protocol is changed',
          'Common absorption blockers: calcium, coffee, proton pump inhibitors, celiac, H. pylori',
          'Common dosing errors: insufficient elemental iron, no co-factors (vitamin C), wrong timing',
        ],
      },
      {
        heading: 'Timing the next upload strategically',
        body: 'Not all retests carry equal value. The highest-information retest windows are: (1) 8–12 weeks after starting a new intervention to confirm it is working, (2) after completing a protocol cycle before deciding whether to continue, taper, or change direction, (3) seasonally for markers with predictable seasonal variation (vitamin D in northern latitudes, cortisol patterns in winter months), (4) after a major stressor such as illness, surgery, or extreme training load that may have shifted baseline markers. Random or purely convenience-driven testing wastes the retest and misses the feedback window.',
        bullets: [
          '8–12 weeks post-intervention: confirmation window for nutritional protocols',
          'Seasonal: vitamin D in autumn/winter, cortisol and melatonin in winter months',
          'After major stressors: illness, surgery, intense training blocks, significant diet change',
          'Avoid < 6-week retests unless clinically urgent — the signal-to-noise ratio is low',
        ],
      },
      {
        heading: 'Understanding change vs noise',
        body: 'Every biomarker has a natural day-to-day and week-to-week variability that is unrelated to any intervention — this is called the coefficient of variation (CV). Ferritin has roughly 15% within-person variability. A ferritin moving from 45 to 50 ng/mL is within natural variation. A move from 45 to 65 ng/mL is a real signal. Understanding this threshold prevents over-interpreting small fluctuations and prevents discarding real progress because it looks modest in absolute terms. VITALOOP applies CV-adjusted significance thresholds to distinguish meaningful change from measurement noise across all tracked markers.',
        bullets: [
          'Ferritin: ~15% CV — changes < 15% are likely noise',
          'Vitamin D: ~10% CV — changes > 10 ng/mL are meaningful',
          'TSH: ~20% CV — requires serial testing before concluding trend',
          'HbA1c: ~3% CV — very stable, small changes are real',
        ],
      },
      {
        heading: 'How cycles compound over time',
        body: 'The first uploaded panel establishes a baseline. The second identifies which interventions are producing measurable change and which are not. The third captures trend velocity — is ferritin rising at the pace expected, or is there a ceiling? By the fourth cycle, the protocol has been iterated at least twice based on measured outcomes rather than assumptions, and the system has enough longitudinal context to catch patterns that single-panel analysis would miss entirely — a slowly declining thyroid output, a seasonally variable vitamin D nadir, a cortisol pattern that spikes every autumn. This is the compounding effect that makes repeated testing qualitatively different from annual check-ups.',
        bullets: [
          'Cycle 1: baseline — identify highest-priority targets',
          'Cycle 2: confirm intervention response — refine dosing and adherence strategy',
          'Cycle 3: capture trend velocity — adjust protocol intensity or targets',
          'Cycle 4+: longitudinal patterns emerge — seasonal variation, cumulative trajectory, multi-marker clusters',
        ],
      },
    ],
    takeaways: [
      'Test 8–12 weeks after an intervention — earlier produces noise, later breaks the feedback loop',
      'Weekly symptom logs are leading indicators that bridge the gap between blood draws',
      'Adherence data is required to interpret biomarker non-response correctly',
      'Use CV thresholds to separate real changes from measurement variability',
      'Compounding context across 3–4 cycles reveals patterns no single panel can show',
    ],
  },

  {
    slug: 'biomarkers-to-action',
    title: 'From biomarkers to action stack',
    description:
      'A guide to translating abnormal markers into prioritized nutrition, supplement, and recovery actions — ranked by leverage, timed for absorption.',
    category: 'Protocol Design',
    readTime: '8 min read',
    intro:
      'Most laboratory interpretation ends at identification: "Your vitamin D is low." The step that transforms information into health outcomes — "so here is what you do, in this order, at these doses, avoiding these interactions, tracked over this timeline" — is rarely provided. The gap between biomarker data and executable protocol is where most people get stuck. This guide covers the translation logic.',
    sections: [
      {
        heading: 'The leverage principle: not all deficiencies are equal',
        body: 'When multiple biomarkers are out of range, addressing them in random order or simultaneously without prioritization produces suboptimal results and makes it impossible to isolate cause and effect. The leverage principle asks: which single correction will create the most downstream improvement across the most other markers? Vitamin D and magnesium are classic high-leverage interventions because they participate in hundreds of enzymatic pathways. Fixing a severe vitamin D deficiency often simultaneously improves mood, immune regulation, calcium metabolism, cortisol patterning, and muscle recovery — without directly targeting any of those.',
        bullets: [
          'Vitamin D: regulates > 200 genes; affects immune, mood, metabolic, and musculoskeletal pathways',
          'Magnesium: cofactor in > 300 enzyme reactions; affects sleep, insulin sensitivity, cortisol, and muscle function',
          'Iron: required for oxygen transport, mitochondrial function, thyroid hormone conversion, and neurotransmitter synthesis',
          'B12: essential for methylation, myelin synthesis, DNA repair, and energy metabolism',
        ],
      },
      {
        heading: 'Priority tiers: where to start',
        body: 'A practical prioritization framework assigns biomarkers to intervention tiers based on clinical urgency, leverage, and risk of ongoing harm from the deficiency. Tier 1 markers need to be addressed before anything else because their absence impairs the effectiveness of every other intervention. You cannot optimize performance on a foundation of iron deficiency, uncorrected thyroid dysfunction, or severe vitamin D insufficiency.',
        bullets: [
          'Tier 1 — address first: ferritin < 30 ng/mL, vitamin D < 20 ng/mL, TSH outside 0.5–4.0 mIU/L, B12 < 200 pg/mL, HbA1c > 5.7%',
          'Tier 2 — address second: magnesium (serum or RBC), zinc, folate, omega-3 index, DHEA-S in age context',
          'Tier 3 — optimize last: free testosterone, sex-hormone binding globulin, cortisol pattern, fasting insulin, hsCRP',
          'Concurrent interventions in the same tier are fine; crossing tiers without resolving Tier 1 dilutes effort',
        ],
      },
      {
        heading: 'Nutrition-first vs supplement-first',
        body: 'For deficiencies in the 30–70% of optimal range, food interventions should precede or accompany supplementation wherever possible. Whole food sources carry co-factors, absorption enhancers, and satiety signaling that isolated supplements do not. Supplementation bridges the gap when dietary correction alone is insufficient — particularly for vitamin D (difficult to obtain from food in northern latitudes), omega-3s (requiring large weekly fatty fish intake for therapeutic doses), and iron (when losses exceed what food can replace).',
        bullets: [
          'Iron + B12: red meat (beef, lamb), organ meats (liver is the most concentrated source), shellfish (oysters for zinc + B12)',
          'Vitamin D + omega-3: fatty fish (salmon, sardines, mackerel 2–3×/week), eggs (D3 in yolk)',
          'Magnesium: pumpkin seeds, dark chocolate (>70%), leafy greens, avocado, black beans',
          'Zinc: oysters, beef, pumpkin seeds, legumes — note that phytic acid in legumes reduces absorption by ~40%',
          'Folate: leafy greens, lentils, asparagus — note the MTHFR variant issue with folic acid vs methylfolate',
        ],
      },
      {
        heading: 'Supplement protocols: doses, forms, and timing',
        body: 'The supplement market is full of products with low-bioavailability forms at inadequate doses. The form of a supplement determines how much is actually absorbed. Magnesium oxide, for example, has roughly 4% bioavailability compared to 80%+ for glycinate or malate. Iron sulfate is cheaper but causes more GI side effects and worse absorption than ferrous bisglycinate. Vitamin D3 should always accompany K2 to direct calcium into bone rather than soft tissue.',
        bullets: [
          'Vitamin D3: 2000–5000 IU/day depending on baseline; always pair with K2 (MK-7, 100–200 mcg) and magnesium',
          'Iron (ferrous bisglycinate): 25–50 mg elemental iron, with vitamin C (250 mg), away from calcium and coffee, alternate-day dosing for better absorption',
          'Magnesium glycinate or malate: 200–400 mg elemental, evening dosing; avoid oxide form',
          'Zinc bisglycinate: 15–30 mg/day; balance with 1–2 mg copper for long-term use to prevent copper depletion',
          'B12 (methylcobalamin): 500–1000 mcg sublingual if levels are low; methylated form preferred over cyanocobalamin',
          'Omega-3 (EPA+DHA): 1–3 g/day combined; take with a fat-containing meal for absorption',
        ],
      },
      {
        heading: 'Absorption conflicts and timing rules',
        body: 'Even perfectly chosen supplements at correct doses will underperform if taken at the wrong time or in conflicting combinations. Absorption conflicts are one of the most common reasons a well-designed protocol produces no measurable biomarker change over 12 weeks. The most important interactions to know are iron vs calcium, iron vs coffee, fat-soluble vitamins (D, A, E, K) with fat-free meals, and zinc vs copper over time.',
        bullets: [
          'Iron and calcium: take 2+ hours apart — calcium directly competes for the same transporter',
          'Iron and coffee/tea: take 1+ hour apart — polyphenols form insoluble iron complexes',
          'Vitamin D, K2, A, E: require dietary fat for absorption — take with any fat-containing meal',
          'Zinc long-term (> 30 mg/day): add 1–2 mg copper to prevent copper deficiency',
          'Folate and B12: work together; deficiency in one can mask deficiency in the other',
          'Magnesium and zinc compete in high doses — take at different times of day if both are dosed high',
        ],
      },
      {
        heading: 'Lifestyle actions that move biomarkers',
        body: 'Supplementation addresses deficiencies, but the largest upstream shifts in key biomarkers come from consistent lifestyle inputs. High-intensity interval training twice per week raises free testosterone, improves insulin sensitivity, and lowers fasting glucose more effectively than most supplements targeting the same pathways. Morning sun exposure for 20–30 minutes accelerates vitamin D synthesis, resets circadian cortisol rhythm, and improves sleep onset latency. Prioritizing sleep to 7–9 hours reduces CRP, lowers cortisol, supports growth hormone pulsatility, and improves thyroid conversion from T4 to T3.',
        bullets: [
          'HIIT 2×/week: raises free testosterone 15–20%, improves insulin sensitivity, reduces fasting glucose',
          'Morning sun exposure (20–30 min): D3 synthesis, circadian cortisol reset, melatonin production improvement',
          '7–9 hours sleep: lowers hs-CRP, supports thyroid (T4→T3 conversion), GH pulsatility, cortisol regulation',
          'Resistance training 3×/week: testosterone, IGF-1, bone density markers, metabolic flexibility',
          'Stress reduction (breathwork, HRV training): lowers cortisol, reduces inflammatory markers, improves HRV',
        ],
      },
      {
        heading: 'When to involve a clinician',
        body: 'Self-directed optimization is appropriate for nutritional deficiencies in the wellness range. It is not appropriate as a substitute for clinical evaluation of potentially pathological findings. Certain biomarker patterns require a physician\'s assessment, not a supplement protocol.',
        bullets: [
          'Iron deficiency without obvious cause in a man or postmenopausal woman: GI bleed workup required',
          'TSH outside 0.5–4.0 mIU/L: thyroid panel (free T3, free T4, TPO antibodies) and physician review',
          'Ferritin > 400 ng/mL with saturation > 45%: hemochromatosis genetic screening (HFE gene)',
          'Fasting glucose > 100 mg/dL or HbA1c > 5.6%: physician evaluation, not supplementation',
          'Any marker with a pattern that repeats across two panels without explanation: clinical workup before protocol change',
        ],
      },
    ],
    takeaways: [
      'Fix Tier 1 markers first — deficiencies in iron, vitamin D, B12, and thyroid impair every other intervention',
      'Form and dose matter as much as the supplement chosen — bioavailability varies by 4–20× across forms',
      'Absorption conflicts silently ruin otherwise correct protocols — timing and combinations are non-negotiable',
      'The highest-leverage biomarker corrections produce multi-system improvements simultaneously',
      'Lifestyle inputs (sleep, HIIT, sun) move the same biomarkers as supplements — and often faster',
      'Certain patterns require clinical evaluation, not protocol optimization',
    ],
  },
]

export function getGuideBySlug(slug) {
  return GUIDES.find((g) => g.slug === slug) ?? null
}
