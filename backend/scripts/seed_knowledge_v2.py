"""
VITALOOP Knowledge Base v2 — 95-biomarker expansion seed.

Run from backend/ dir:
    source .venv/bin/activate
    python scripts/seed_knowledge_v2.py

Skips rules/recs whose key already exists (idempotent).
Categories:
  1  Iron & Hematology        2  Metabolic / Glucose
  3  Lipid Panel              4  Liver Function
  5  Kidney Function          6  Thyroid
  7  Vitamins & Minerals      8  Inflammation
  9  Sex Hormones             10 Adrenal / Stress
  11 Cardiac Markers          12 Coagulation
  13 Electrolytes             14 Tumor Markers / Bone
"""

import asyncio, sys, os, json
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.services import supabase_service as svc

# ── helpers ─────────────────────────────────────────────────────────────────

def rule(key, name, description, input_entities, conditions, outputs,
         confidence, severity, requires_doctor, explanation_template,
         source="clinical_guideline_placeholder",
         source_url="https://www.who.int/health-topics/laboratory-quality"):
    return {
        "key": key, "name": name, "description": description,
        "input_entities": input_entities, "conditions": conditions,
        "outputs": outputs, "confidence": confidence, "severity": severity,
        "requires_doctor": requires_doctor,
        "explanation_template": explanation_template,
        "source": source, "source_url": source_url,
        "governance_status": "active", "active": True,
        "version": "v1", "change_note": "seed_kb_v2",
        "medical_reviewed_at": "2026-06-27T00:00:00+00:00",
    }

def rec(key, title, body, category, priority, requires_doctor=False,
        evidence_level="moderate",
        source="clinical_guideline_placeholder",
        source_url="https://www.who.int/health-topics/laboratory-quality"):
    return {
        "key": key, "title": title, "body": body,
        "category": category, "priority": priority,
        "requires_doctor": requires_doctor, "evidence_level": evidence_level,
        "source": source, "source_url": source_url,
    }

# ── RECOMMENDATIONS ──────────────────────────────────────────────────────────

RECOMMENDATIONS = [
    # ── Hematology ──────────────────────────────────────────────────────────
    rec("anemia_workup", "Full Anemia Workup",
        "Request CBC, iron panel, ferritin, B12, folate and reticulocyte count to classify the anemia type before treatment.",
        "hematology", "high", True, "high"),
    rec("iron_rich_diet", "Iron-Rich Diet Guidance",
        "Increase dietary heme iron (red meat, poultry, fish) and non-heme sources (legumes, leafy greens). Combine with vitamin C to improve absorption; avoid tea and calcium-rich foods within 1 h of iron meals.",
        "hematology", "medium", False, "high"),
    rec("iron_supplementation_review", "Iron Supplementation Review",
        "Consider oral iron supplementation (e.g., ferrous sulfate 325 mg TID with food) after confirming iron-deficiency etiology. Re-check CBC and ferritin after 8 weeks.",
        "hematology", "high", True, "high"),
    rec("serum_iron_tibc_recheck", "Repeat Iron Panel",
        "Re-measure serum iron, TIBC, transferrin saturation and ferritin simultaneously to evaluate iron stores and transport capacity.",
        "hematology", "medium", False, "high"),
    rec("rbc_morphology_review", "RBC Morphology Review",
        "Order peripheral blood smear to assess RBC morphology. Findings guide the distinction between microcytic, normocytic and macrocytic anemia subtypes.",
        "hematology", "high", True, "high"),
    rec("leukocytosis_workup", "Leukocytosis Workup",
        "Elevated WBC may indicate infection, inflammation or haematological disorder. Obtain differential count, CRP, ESR and consider peripheral smear.",
        "hematology", "high", True, "high"),
    rec("leukopenia_followup", "Leukopenia Follow-up",
        "Low WBC requires review of medications, nutritional status (B12/folate/copper), autoimmune screen and bone marrow reserve. Repeat CBC in 2-4 weeks.",
        "hematology", "high", True, "high"),
    rec("thrombocytopenia_review", "Thrombocytopenia Evaluation",
        "Platelet count below 100 × 10⁹/L warrants haematology review for ITP, bone marrow pathology or medication-induced causes.",
        "hematology", "high", True, "high"),
    rec("thrombocytosis_followup", "Reactive vs. Clonal Thrombocytosis",
        "Distinguish reactive thrombocytosis (iron deficiency, infection) from clonal causes (essential thrombocythaemia). Investigate iron status and inflammatory markers.",
        "hematology", "high", True, "moderate"),
    rec("neutrophilia_infection_screen", "Infection & Inflammation Screen",
        "Neutrophil count > 7.5 × 10⁹/L suggests bacterial infection or systemic inflammation. Obtain CRP, blood cultures if febrile, and urine analysis.",
        "hematology", "high", True, "high"),
    rec("lymphocytosis_review", "Lymphocytosis Assessment",
        "Persistent lymphocytosis warrants differential (viral infection, CLL). Request blood film, LDH and flow cytometry if clinically indicated.",
        "hematology", "high", True, "moderate"),
    rec("eosinophilia_followup", "Eosinophilia Workup",
        "Eosinophil count > 0.5 × 10⁹/L requires investigation for allergy, parasitic infection, or hypereosinophilic syndrome. Stool parasitology and IgE level.",
        "hematology", "medium", True, "moderate"),
    rec("mcv_correction", "Address MCV Abnormality",
        "Microcytosis (MCV < 80 fL) suggests iron, thalassaemia, or copper deficiency. Macrocytosis (MCV > 100 fL) suggests B12/folate deficiency, hypothyroidism, or alcohol excess.",
        "hematology", "medium", True, "high"),

    # ── Metabolic ───────────────────────────────────────────────────────────
    rec("insulin_resistance_plan", "Insulin Resistance Action Plan",
        "Lifestyle modification is first-line: Mediterranean or low-glycaemic diet, 150 min/week aerobic exercise, 7-9 h sleep, stress management. Monitor fasting glucose and HbA1c every 3 months.",
        "metabolic", "high", False, "high"),
    rec("diabetes_screening_referral", "Diabetes Specialist Referral",
        "HbA1c ≥ 6.5% or fasting glucose ≥ 7.0 mmol/L (126 mg/dL) meets diabetes diagnostic threshold. Urgent endocrinology referral and comprehensive metabolic panel.",
        "metabolic", "high", True, "high"),
    rec("prediabetes_lifestyle", "Prediabetes Prevention Protocol",
        "HbA1c 5.7-6.4% (39-47 mmol/mol) — intensive lifestyle modification reduces diabetes risk by ~58%. Weight loss ≥ 5-7%, low-glycaemic diet, regular exercise.",
        "metabolic", "high", False, "high"),
    rec("fructosamine_monitoring", "Fructosamine for Short-Term Glucose Control",
        "Fructosamine reflects 2-3 week glucose average — useful in haemoglobin variants where HbA1c is unreliable. Target < 285 μmol/L for non-diabetics.",
        "metabolic", "medium", True, "moderate"),
    rec("homa_ir_lifestyle", "HOMA-IR Reduction Strategy",
        "HOMA-IR > 2.5 suggests insulin resistance. Prioritise low-carbohydrate diet, resistance training 2×/week, improved sleep hygiene, and manage visceral adiposity.",
        "metabolic", "medium", False, "moderate"),

    # ── Lipids ──────────────────────────────────────────────────────────────
    rec("statin_consideration", "Statin Therapy Discussion",
        "High LDL or elevated cardiovascular risk score warrants discussion of statin therapy. Calculate 10-year CVD risk (e.g., SCORE2) before initiating pharmacotherapy.",
        "cardiometabolic", "high", True, "high"),
    rec("lipid_lifestyle_plan", "Lipid-Lowering Lifestyle Plan",
        "Reduce saturated fat < 7% of calories, increase soluble fibre (oats, legumes), plant sterols 2 g/day, and aerobic exercise ≥ 150 min/week.",
        "cardiometabolic", "medium", False, "high"),
    rec("lpa_cardiovascular_risk", "Lp(a) Cardiovascular Risk Awareness",
        "Lp(a) > 50 mg/dL is an independent CVD risk factor. Discuss with cardiologist regarding intensified LDL lowering and lifestyle measures.",
        "cardiometabolic", "high", True, "high"),
    rec("apob_risk_reassessment", "ApoB-Guided Risk Reassessment",
        "ApoB reflects the number of atherogenic particles and may better predict CVD risk than LDL-C alone. High ApoB despite normal LDL warrants intensified intervention.",
        "cardiometabolic", "high", True, "moderate"),
    rec("hdl_raising_plan", "HDL-Raising Strategy",
        "Low HDL (< 1.0 mmol/L men, < 1.2 mmol/L women): aerobic exercise, smoking cessation, weight loss, and Mediterranean diet. Niacin or fibrates if clinically indicated.",
        "cardiometabolic", "medium", False, "high"),
    rec("triglyceride_diet_plan", "Triglyceride Reduction Diet",
        "Restrict refined carbohydrates and added sugar, eliminate trans fats, limit alcohol. Omega-3 fatty acids (EPA+DHA ≥ 2 g/day) significantly lower triglycerides.",
        "cardiometabolic", "medium", False, "high"),

    # ── Liver ───────────────────────────────────────────────────────────────
    rec("ggt_alcohol_screen", "GGT — Alcohol & Drug Review",
        "Elevated GGT is sensitive for alcohol use, fatty liver, and drug-induced hepatotoxicity. Review alcohol intake, medications, and herbal supplements.",
        "liver", "medium", False, "high"),
    rec("alp_biliary_followup", "ALP — Biliary & Bone Workup",
        "Elevated ALP with normal GGT suggests bone origin. Isolated ALP with elevated GGT suggests biliary obstruction. Order GGT, abdominal ultrasound, and bone isoenzymes.",
        "liver", "high", True, "high"),
    rec("bilirubin_workup", "Bilirubin Elevation Workup",
        "Distinguish haemolytic (indirect ↑), hepatocellular (both ↑), or cholestatic (direct ↑) jaundice. Order LFT, LDH, haptoglobin, abdominal ultrasound.",
        "liver", "high", True, "high"),
    rec("low_albumin_nutrition", "Albumin — Nutritional & Hepatic Support",
        "Low albumin reflects protein-energy malnutrition or chronic liver/kidney disease. Assess dietary protein intake (target 1.2-1.5 g/kg/day) and liver synthetic function.",
        "liver", "high", True, "high"),
    rec("liver_ultrasound", "Abdominal Ultrasound",
        "Persistent liver enzyme elevation warrants abdominal ultrasound to assess liver texture, biliary tree and portal hypertension signs.",
        "liver", "high", True, "high"),

    # ── Kidney ──────────────────────────────────────────────────────────────
    rec("ckd_management_plan", "CKD Management Protocol",
        "eGFR < 60 mL/min/1.73m² on two readings ≥ 3 months apart = CKD. Referral to nephrology, RAAS inhibition if proteinuric, BP < 130/80, dietary protein moderation.",
        "kidney", "high", True, "high"),
    rec("uric_acid_lifestyle", "Uric Acid Reduction Plan",
        "Limit purine-rich foods (organ meats, shellfish, beer), increase hydration (≥ 2 L/day), reduce fructose. Allopurinol if recurrent gout or uric acid > 500 μmol/L.",
        "kidney", "medium", False, "high"),
    rec("bun_hydration_check", "Hydration & Protein Intake Review",
        "Elevated BUN may reflect dehydration, high protein intake, or pre-renal azotaemia. Assess fluid intake, dietary protein, and concurrent creatinine.",
        "kidney", "medium", False, "moderate"),
    rec("creatinine_trend_monitoring", "Serial Creatinine Monitoring",
        "Track creatinine trajectory over 3-6 months. Acute rise > 26.5 μmol/L within 48 h or > 1.5× baseline warrants urgent nephrology assessment (AKI criteria).",
        "kidney", "high", True, "high"),
    rec("kidney_diet_advice", "Kidney-Protective Diet",
        "Reduce sodium (< 2 g/day), moderate protein (0.8 g/kg/day if CKD ≥ stage 3), limit potassium/phosphorus in advanced CKD. Avoid NSAIDs and nephrotoxic agents.",
        "kidney", "medium", True, "high"),

    # ── Thyroid ─────────────────────────────────────────────────────────────
    rec("hypothyroid_treatment_review", "Hypothyroidism Treatment Review",
        "TSH > 10 mIU/L warrants levothyroxine initiation. TSH 4.5-10 mIU/L — treat if symptomatic or anti-TPO positive. Monitor TSH every 6-8 weeks after dose adjustment.",
        "endocrine", "high", True, "high"),
    rec("hyperthyroid_referral", "Hyperthyroidism Specialist Referral",
        "Suppressed TSH with elevated free T4/T3 requires endocrinology referral. Obtain thyroid antibodies, radioactive iodine uptake scan to differentiate Graves' vs. nodular disease.",
        "endocrine", "high", True, "high"),
    rec("thyroid_antibody_monitoring", "Thyroid Antibody Follow-Up",
        "Positive anti-TPO or anti-TG antibodies indicate autoimmune thyroiditis (Hashimoto's). Annual TSH monitoring recommended even if currently euthyroid.",
        "endocrine", "medium", True, "high"),
    rec("subclinical_thyroid_plan", "Subclinical Thyroid Dysfunction Plan",
        "Subclinical hypothyroidism (TSH 4.5-10, normal T4): repeat in 3-6 months, treat if pregnant, symptomatic, anti-TPO positive, or TSH > 7.",
        "endocrine", "medium", True, "high"),
    rec("free_t3_t4_interpretation", "Free T3/T4 Clinical Interpretation",
        "Isolated free T3 elevation suggests early hyperthyroidism or T3 toxicosis. Low free T4 with normal TSH may indicate secondary hypothyroidism — request pituitary screen.",
        "endocrine", "medium", True, "moderate"),

    # ── Vitamins & Minerals ─────────────────────────────────────────────────
    rec("b12_supplementation", "Vitamin B12 Supplementation Protocol",
        "B12 < 200 pmol/L: oral cyanocobalamin 1000 μg/day or IM hydroxocobalamin 1 mg every 3 months. Investigate cause (pernicious anaemia, malabsorption, veganism) before supplementing.",
        "micronutrient", "high", False, "high"),
    rec("folate_supplementation", "Folate Supplementation & Diet",
        "Folate deficiency: folic acid 5 mg/day for 4 months. Increase dietary sources (leafy greens, legumes). Essential pre-conception supplementation at ≥ 400 μg/day.",
        "micronutrient", "high", False, "high"),
    rec("zinc_supplementation", "Zinc Status Optimisation",
        "Zinc < 10 μmol/L: supplementation 15-30 mg elemental zinc daily. Separate from iron/calcium supplements. Reassess after 3 months.",
        "micronutrient", "medium", False, "moderate"),
    rec("magnesium_repletion", "Magnesium Repletion Plan",
        "Magnesium < 0.7 mmol/L: oral magnesium glycinate or citrate 200-400 mg elemental/day (better GI tolerance than oxide). Increase dietary sources: nuts, seeds, dark chocolate, legumes.",
        "micronutrient", "medium", False, "high"),
    rec("selenium_status_review", "Selenium Status Review",
        "Selenium < 70 μg/L is associated with impaired thyroid function and increased oxidative stress. Brazil nuts (2/day), seafood, and eggs are rich sources.",
        "micronutrient", "medium", False, "moderate"),
    rec("copper_status_review", "Copper Status Evaluation",
        "Low copper can cause microcytic anaemia, leukopenia and neurological symptoms. High copper (Wilson's disease) requires specialist evaluation. Avoid excess zinc supplementation.",
        "micronutrient", "medium", True, "moderate"),
    rec("vitamin_a_review", "Vitamin A Status Review",
        "Vitamin A < 0.7 μmol/L may impair immunity, vision and epithelial integrity. Supplementation requires caution — toxicity occurs at high doses (especially in pregnancy).",
        "micronutrient", "medium", True, "moderate"),
    rec("vitamin_e_antioxidant", "Vitamin E — Antioxidant Support",
        "Vitamin E < 12 μmol/L: increase dietary sources (sunflower seeds, almonds, avocado). Supplementation at > 400 IU/day is not recommended without medical supervision.",
        "micronutrient", "low", False, "moderate"),

    # ── Inflammation ────────────────────────────────────────────────────────
    rec("crp_infection_screen", "Infection / Inflammation Workup",
        "CRP > 10 mg/L suggests significant infection or inflammation. Assess CBC, urine analysis, chest X-ray and clinical symptoms. Track trend over 48-72 h.",
        "inflammation", "high", True, "high"),
    rec("hs_crp_cvd_risk", "hs-CRP Cardiovascular Risk Reduction",
        "hs-CRP 1-3 mg/L = intermediate CVD risk; > 3 mg/L = high risk. Target anti-inflammatory lifestyle: omega-3, Mediterranean diet, exercise, smoking cessation, statins if indicated.",
        "inflammation", "high", False, "high"),
    rec("homocysteine_reduction", "Homocysteine Reduction Protocol",
        "Homocysteine > 15 μmol/L: supplementation with folate (5 mg/day), B6 (100 mg/day) and B12 (1000 μg/day) typically reduces levels by 25-30%.",
        "inflammation", "medium", False, "high"),
    rec("esr_followup", "ESR Follow-Up",
        "Elevated ESR is non-specific. Correlate with CRP, CBC and clinical history. Persistent elevation without explanation warrants rheumatology or haematology referral.",
        "inflammation", "medium", True, "moderate"),
    rec("fibrinogen_cvd_risk", "Fibrinogen & Cardiovascular Risk",
        "Fibrinogen > 4 g/L is associated with increased thrombosis and CVD risk. Address smoking, physical inactivity and metabolic syndrome.",
        "inflammation", "medium", True, "moderate"),

    # ── Sex Hormones ────────────────────────────────────────────────────────
    rec("testosterone_optimisation", "Testosterone Optimisation Plan",
        "Confirm low testosterone with morning repeat fasting sample. Evaluate LH/FSH to distinguish primary (testicular) from secondary (pituitary) hypogonadism. Endocrinology referral.",
        "endocrine", "high", True, "high"),
    rec("estradiol_followup", "Estradiol Evaluation",
        "Estradiol outside reference range warrants clinical context: menstrual cycle phase, PCOS, menopause status, exogenous hormone use. Correlate with LH, FSH and symptoms.",
        "endocrine", "medium", True, "moderate"),
    rec("amh_fertility_counselling", "AMH Fertility Counselling",
        "Low AMH (< 1 ng/mL) suggests diminished ovarian reserve. Reproductive endocrinology consultation recommended if pregnancy desired. Not predictive of natural conception.",
        "endocrine", "high", True, "high"),
    rec("lh_fsh_pituitary_review", "LH/FSH Pituitary Axis Review",
        "Elevated LH/FSH with low sex steroids = primary gonadal failure. Low LH/FSH with low sex steroids = secondary (pituitary/hypothalamic) cause. MRI pituitary if secondary suspected.",
        "endocrine", "high", True, "high"),
    rec("prolactin_followup", "Elevated Prolactin Workup",
        "Exclude physiological causes (stress, post-meal, pregnancy). If confirmed elevated: check medications, thyroid function, and pituitary MRI if macroprolactin excluded.",
        "endocrine", "high", True, "high"),
    rec("dhea_s_adrenal_review", "DHEA-S Adrenal Review",
        "Low DHEA-S may reflect adrenal insufficiency or ageing. High DHEA-S in women suggests adrenal androgen excess (CAH, adrenal tumour). Correlate with clinical picture.",
        "endocrine", "medium", True, "moderate"),
    rec("shbg_metabolic_link", "SHBG & Metabolic Health",
        "Low SHBG correlates with insulin resistance, obesity and metabolic syndrome. High SHBG may reduce bioavailable androgens/oestrogens. Address underlying metabolic drivers.",
        "endocrine", "medium", False, "moderate"),
    rec("progesterone_monitoring", "Progesterone Cycle Monitoring",
        "Mid-luteal progesterone < 30 nmol/L suggests anovulation. Timed sampling (day 21 of 28-day cycle) is essential. Track across multiple cycles if irregular.",
        "endocrine", "medium", True, "moderate"),

    # ── Adrenal / Cortisol ──────────────────────────────────────────────────
    rec("cortisol_adrenal_review", "Cortisol — Adrenal Function Review",
        "Low cortisol (< 138 nmol/L morning) suggests adrenal insufficiency — urgent short Synacthen test. High cortisol — exclude Cushing syndrome with 24 h UFC or late-night salivary cortisol.",
        "endocrine", "high", True, "high"),
    rec("stress_cortisol_management", "Stress-Related Cortisol Management",
        "Chronically elevated cortisol from psychological stress: structured relaxation, sleep hygiene, mindfulness, and exercise. Adaptogens (ashwagandha) show modest evidence.",
        "endocrine", "medium", False, "moderate"),

    # ── Cardiac ─────────────────────────────────────────────────────────────
    rec("bnp_cardiac_review", "BNP/NT-proBNP Cardiac Evaluation",
        "Elevated BNP/NT-proBNP suggests cardiac stress (heart failure, PE, AF). Urgent cardiology referral and echocardiography.",
        "cardiac", "high", True, "high"),
    rec("troponin_urgent_referral", "Troponin — Urgent Cardiac Assessment",
        "Any elevation of high-sensitivity troponin warrants urgent cardiology evaluation to rule out ACS (NSTEMI, unstable angina). Serial measurements at 0/3 h or 0/1 h.",
        "cardiac", "high", True, "high"),
    rec("ck_muscle_damage_review", "CK — Muscle Damage Review",
        "Elevated CK: review intense exercise (48-72 h recovery), medications (statins, antipsychotics), myositis, or rhabdomyolysis. CK > 10× ULN warrants urgent review.",
        "cardiac", "high", True, "high"),

    # ── Coagulation ─────────────────────────────────────────────────────────
    rec("inr_anticoagulation_review", "INR — Anticoagulation Review",
        "INR outside therapeutic range (2.0-3.0 for most AF/VTE indications) requires anticoagulation dose adjustment. Assess diet, medications, adherence.",
        "coagulation", "high", True, "high"),
    rec("d_dimer_thrombosis_screen", "D-dimer — VTE Screening",
        "Elevated D-dimer is sensitive but non-specific for VTE. In high pre-test probability, proceed to imaging (duplex ultrasound, CTPA). Age-adjusted cut-off (age × 10 μg/L if > 50 y).",
        "coagulation", "high", True, "high"),
    rec("aptt_bleed_risk_review", "aPTT — Bleeding Risk Review",
        "Prolonged aPTT: check for heparin contamination, factor deficiencies (VIII, IX, XI — haemophilia), lupus anticoagulant. Haematology referral if not explained.",
        "coagulation", "high", True, "high"),

    # ── Electrolytes ────────────────────────────────────────────────────────
    rec("hyponatremia_workup", "Hyponatraemia Workup",
        "Na < 135 mmol/L: assess volume status, urine sodium/osmolality. SIADH, hypothyroidism, heart failure/cirrhosis are common causes. Correct slowly — risk of ODS if corrected too fast.",
        "metabolic", "high", True, "high"),
    rec("hypokalemia_correction", "Hypokalaemia Correction",
        "K < 3.5 mmol/L: oral potassium chloride 40-80 mmol/day. Assess cause (diarrhoea, diuretics, vomiting, hyperaldosteronism). IV replacement if K < 2.5 or symptomatic.",
        "metabolic", "high", True, "high"),
    rec("calcium_workup", "Calcium Abnormality Workup",
        "Hypercalcaemia: PTH and PTHrP to distinguish primary hyperparathyroidism from malignancy. Hypocalcaemia: check PTH, vitamin D, magnesium.",
        "metabolic", "high", True, "high"),
    rec("phosphorus_balance", "Phosphorus Balance Review",
        "Low phosphorus: evaluate malnutrition, malabsorption, refeeding syndrome. High phosphorus in CKD requires dietary restriction and phosphate binders.",
        "metabolic", "medium", True, "moderate"),

    # ── Tumor Markers / Bone ────────────────────────────────────────────────
    rec("psa_urology_referral", "PSA — Urology Referral",
        "PSA > 4 ng/mL or rapid PSA velocity requires urology consultation and possible MRI prostate ± biopsy. Discuss benefits and harms of prostate cancer screening.",
        "oncology", "high", True, "high"),
    rec("ca125_gynecology_referral", "CA-125 — Gynaecology Referral",
        "CA-125 > 35 U/mL warrants clinical correlation: ovarian pathology, endometriosis, peritoneal disease. Pelvic ultrasound and gynaecology referral.",
        "oncology", "high", True, "high"),
    rec("cea_surveillance", "CEA Surveillance Plan",
        "CEA is used for monitoring colorectal cancer recurrence, not diagnosis. Rising trend post-resection warrants imaging. Smoking elevates CEA non-specifically.",
        "oncology", "high", True, "moderate"),
    rec("afp_liver_screen", "AFP — Hepatocellular Carcinoma Screening",
        "AFP > 400 ng/mL has high specificity for HCC in cirrhosis context. Abdominal ultrasound and triphasic CT/MRI liver indicated.",
        "oncology", "high", True, "high"),
    rec("pth_parathyroid_review", "PTH — Parathyroid Review",
        "Elevated PTH with hypercalcaemia = primary hyperparathyroidism (parathyroid adenoma most likely). Elevated PTH with hypocalcaemia = secondary/tertiary. Endocrinology referral.",
        "endocrine", "high", True, "high"),
    rec("osteocalcin_bone_health", "Bone Health Optimisation",
        "Low osteocalcin (bone formation marker) suggests impaired bone turnover. Ensure adequate vitamin D (> 75 nmol/L), calcium, resistance exercise. Rule out corticosteroid use.",
        "endocrine", "medium", False, "moderate"),
]

# ── RULES ────────────────────────────────────────────────────────────────────

RULES = [

    # ════════════════════════════════════════════════════════════════════════
    # 1. IRON & HEMATOLOGY
    # ════════════════════════════════════════════════════════════════════════

    rule("rule_low_serum_iron", "Low Serum Iron",
         "Serum iron below reference suggests iron deficiency or chronic disease.",
         ["iron"],
         {"all": [{"lab_marker": "iron", "operator": "lt", "value": 9, "unit": "μmol/L"}]},
         {"risk": "possible_iron_deficiency", "summary": "Serum iron is low — may indicate iron deficiency or redistribution in chronic disease.",
          "recommendation_keys": ["serum_iron_tibc_recheck", "iron_rich_diet"]},
         0.70, "moderate", False,
         "Serum iron ({{iron_value}} {{iron_unit}}) is below the lower reference limit. Correlate with ferritin and TIBC."),

    rule("rule_low_transferrin_saturation", "Low Transferrin Saturation",
         "Transferrin saturation < 20% is consistent with iron deficiency.",
         ["transferrin_saturation"],
         {"all": [{"lab_marker": "transferrin_saturation", "operator": "lt", "value": 20, "unit": "%"}]},
         {"risk": "iron_deficiency_risk", "summary": "Transferrin saturation is low, consistent with iron deficiency.",
          "recommendation_keys": ["serum_iron_tibc_recheck", "iron_supplementation_review"]},
         0.74, "moderate", False,
         "Transferrin saturation ({{transferrin_saturation_value}}%) is below 20%, indicating that a significant proportion of binding capacity is unfilled."),

    rule("rule_elevated_tibc", "Elevated TIBC — Iron Deficiency",
         "TIBC > 72 μmol/L suggests iron deficiency as the body upregulates transferrin.",
         ["tibc"],
         {"all": [{"lab_marker": "tibc", "operator": "gt", "value": 72, "unit": "μmol/L"}]},
         {"risk": "iron_deficiency_risk", "summary": "High TIBC reflects increased iron-binding capacity, consistent with iron deficiency.",
          "recommendation_keys": ["serum_iron_tibc_recheck", "iron_rich_diet"]},
         0.72, "moderate", False,
         "TIBC ({{tibc_value}} {{tibc_unit}}) is elevated, indicating upregulated transferrin production as a compensatory response to low iron stores."),

    rule("rule_low_hemoglobin_anemia", "Low Hemoglobin — Anaemia",
         "Haemoglobin below sex-specific threshold indicates anaemia.",
         ["hemoglobin"],
         {"all": [{"lab_marker": "hemoglobin", "operator": "lt", "value": 120, "unit": "g/L"}]},
         {"risk": "anaemia_risk", "summary": "Haemoglobin is below 120 g/L — consistent with anaemia. Investigate cause.",
          "recommendation_keys": ["anemia_workup", "rbc_morphology_review"]},
         0.82, "high", True,
         "Haemoglobin ({{hemoglobin_value}} {{hemoglobin_unit}}) is below the anaemia threshold. Full blood count and iron studies are warranted."),

    rule("rule_high_hemoglobin", "Elevated Haemoglobin — Polycythaemia",
         "Haemoglobin > 175 g/L may reflect dehydration, high altitude, or polycythaemia vera.",
         ["hemoglobin"],
         {"all": [{"lab_marker": "hemoglobin", "operator": "gt", "value": 175, "unit": "g/L"}]},
         {"risk": "polycythaemia_risk", "summary": "Elevated haemoglobin warrants investigation for polycythaemia vera or secondary causes.",
          "recommendation_keys": ["anemia_workup"]},
         0.76, "high", True,
         "Haemoglobin ({{hemoglobin_value}} {{hemoglobin_unit}}) is elevated above 175 g/L. Haematology review recommended."),

    rule("rule_low_mcv_microcytosis", "Microcytosis — Low MCV",
         "MCV < 80 fL is consistent with iron deficiency, thalassaemia or chronic disease anaemia.",
         ["mcv"],
         {"all": [{"lab_marker": "mcv", "operator": "lt", "value": 80, "unit": "fL"}]},
         {"risk": "microcytic_anaemia_risk", "summary": "Low MCV indicates microcytic anaemia — likely iron deficiency or thalassaemia.",
          "recommendation_keys": ["mcv_correction", "anemia_workup"]},
         0.78, "moderate", True,
         "MCV ({{mcv_value}} {{mcv_unit}}) is below 80 fL. Consider iron deficiency, thalassaemia trait or sideroblastic anaemia."),

    rule("rule_high_mcv_macrocytosis", "Macrocytosis — High MCV",
         "MCV > 100 fL suggests B12/folate deficiency, hypothyroidism, alcohol excess, or myelodysplasia.",
         ["mcv"],
         {"all": [{"lab_marker": "mcv", "operator": "gt", "value": 100, "unit": "fL"}]},
         {"risk": "macrocytic_anaemia_risk", "summary": "Elevated MCV suggests macrocytic anaemia — investigate B12, folate, thyroid, and alcohol.",
          "recommendation_keys": ["mcv_correction", "anemia_workup", "b12_supplementation"]},
         0.78, "moderate", True,
         "MCV ({{mcv_value}} {{mcv_unit}}) exceeds 100 fL. Request B12, folate, TSH and reticulocyte count."),

    rule("rule_low_reticulocyte_volume_indices_context", "Low Reticulocyte Volume Indices — Context Required",
         "Low reticulocyte volume indices can be useful only when interpreted with CBC, iron, B12/folate, inflammation, symptoms, and age context.",
         ["mean_reticulocyte_volume", "mean_spherical_cell_volume", "reticulocytes"],
         {"all": [
             {"lab_marker": "mean_reticulocyte_volume", "operator": "lt", "value": 92.7, "unit": "fL"},
             {"lab_marker": "mean_spherical_cell_volume", "operator": "lt", "value": 72.8, "unit": "fL"}
         ]},
         {"risk": "reticulocyte_indices_context_required",
          "summary": "Reticulocyte volume indices are low; interpret with CBC, iron status, B12/folate and symptoms before drawing conclusions.",
          "recommendation_keys": ["anemia_workup", "serum_iron_tibc_recheck"]},
         0.66, "moderate", False,
         "Mean Reticulocyte Volume and Mean Spherical Cell Volume are below reference. Review with CBC indices, ferritin, transferrin saturation, B12, folate and clinical context."),

    rule("rule_high_wbc", "Leukocytosis — Elevated WBC",
         "WBC > 11 × 10⁹/L suggests infection, inflammation, haematological malignancy, or stress response.",
         ["wbc"],
         {"all": [{"lab_marker": "wbc", "operator": "gt", "value": 11, "unit": "10^9/L"}]},
         {"risk": "leukocytosis_risk", "summary": "Elevated white cell count requires differential and clinical correlation.",
          "recommendation_keys": ["leukocytosis_workup"]},
         0.76, "moderate", True,
         "WBC ({{wbc_value}} {{wbc_unit}}) is elevated. Obtain differential count, CRP and clinical assessment."),

    rule("rule_low_wbc", "Leukopenia — Low WBC",
         "WBC < 3.5 × 10⁹/L raises concern for bone marrow suppression, autoimmune disease or viral infection.",
         ["wbc"],
         {"all": [{"lab_marker": "wbc", "operator": "lt", "value": 3.5, "unit": "10^9/L"}]},
         {"risk": "leukopenia_risk", "summary": "Low WBC may indicate immune suppression, viral illness or bone marrow pathology.",
          "recommendation_keys": ["leukopenia_followup"]},
         0.78, "high", True,
         "WBC ({{wbc_value}} {{wbc_unit}}) is below 3.5 × 10⁹/L. Assess neutrophil count, viral serology and medication history."),

    rule("rule_low_neutrophils", "Neutropenia",
         "Neutrophil count < 1.8 × 10⁹/L increases infection susceptibility.",
         ["neutrophils"],
         {"all": [{"lab_marker": "neutrophils", "operator": "lt", "value": 1.8, "unit": "10^9/L"}]},
         {"risk": "neutropenia_risk", "summary": "Neutropenia increases risk of bacterial infection. Identify cause urgently.",
          "recommendation_keys": ["leukopenia_followup"]},
         0.82, "high", True,
         "Neutrophil count ({{neutrophils_value}} {{neutrophils_unit}}) is below 1.8 × 10⁹/L. Urgent haematology assessment if < 0.5 × 10⁹/L."),

    rule("rule_high_neutrophils", "Neutrophilia",
         "Neutrophil count > 7.5 × 10⁹/L typically indicates bacterial infection or systemic inflammation.",
         ["neutrophils"],
         {"all": [{"lab_marker": "neutrophils", "operator": "gt", "value": 7.5, "unit": "10^9/L"}]},
         {"risk": "infection_inflammation_risk", "summary": "Elevated neutrophil count suggests bacterial infection, inflammation, or steroid effect.",
          "recommendation_keys": ["neutrophilia_infection_screen"]},
         0.76, "moderate", True,
         "Neutrophils ({{neutrophils_value}} {{neutrophils_unit}}) are elevated. Consider infection, corticosteroid use, or reactive cause."),

    rule("rule_high_lymphocytes", "Lymphocytosis",
         "Lymphocyte count > 4.0 × 10⁹/L may indicate viral infection or lymphoproliferative disease.",
         ["lymphocytes"],
         {"all": [{"lab_marker": "lymphocytes", "operator": "gt", "value": 4.0, "unit": "10^9/L"}]},
         {"risk": "lymphocytosis_risk", "summary": "Elevated lymphocytes may reflect viral illness or lymphoproliferative disorder.",
          "recommendation_keys": ["lymphocytosis_review"]},
         0.72, "moderate", True,
         "Lymphocyte count ({{lymphocytes_value}} {{lymphocytes_unit}}) is elevated. EBV/CMV serology and peripheral blood film recommended."),

    rule("rule_high_eosinophils", "Eosinophilia",
         "Eosinophil count > 0.5 × 10⁹/L suggests allergy, parasite or hypereosinophilic syndrome.",
         ["eosinophils"],
         {"all": [{"lab_marker": "eosinophils", "operator": "gt", "value": 0.5, "unit": "10^9/L"}]},
         {"risk": "eosinophilia_risk", "summary": "Elevated eosinophils — consider allergic or parasitic aetiology.",
          "recommendation_keys": ["eosinophilia_followup"]},
         0.70, "moderate", False,
         "Eosinophil count ({{eosinophils_value}} {{eosinophils_unit}}) is elevated. Investigate allergy, parasitosis and drug reaction."),

    rule("rule_low_platelets", "Thrombocytopenia",
         "Platelet count < 100 × 10⁹/L increases haemorrhagic risk and warrants haematology evaluation.",
         ["platelets"],
         {"all": [{"lab_marker": "platelets", "operator": "lt", "value": 100, "unit": "10^9/L"}]},
         {"risk": "thrombocytopenia_risk", "summary": "Low platelet count may increase bleeding risk. Haematology evaluation required.",
          "recommendation_keys": ["thrombocytopenia_review"]},
         0.82, "high", True,
         "Platelet count ({{platelets_value}} {{platelets_unit}}) is below 100 × 10⁹/L. Assess bone marrow, immune thrombocytopenia and medication causes."),

    rule("rule_high_platelets", "Thrombocytosis",
         "Platelet count > 450 × 10⁹/L can be reactive (iron deficiency, inflammation) or clonal (ET).",
         ["platelets"],
         {"all": [{"lab_marker": "platelets", "operator": "gt", "value": 450, "unit": "10^9/L"}]},
         {"risk": "thrombocytosis_risk", "summary": "Elevated platelet count — distinguish reactive from primary thrombocytosis.",
          "recommendation_keys": ["thrombocytosis_followup"]},
         0.70, "moderate", True,
         "Platelets ({{platelets_value}} {{platelets_unit}}) exceed 450 × 10⁹/L. Assess iron status, inflammatory markers and JAK2 mutation if persistent."),

    # ════════════════════════════════════════════════════════════════════════
    # 2. METABOLIC / GLUCOSE
    # ════════════════════════════════════════════════════════════════════════

    rule("rule_high_insulin", "Hyperinsulinaemia",
         "Fasting insulin > 25 mIU/L suggests significant insulin resistance.",
         ["insulin"],
         {"all": [{"lab_marker": "insulin", "operator": "gt", "value": 25, "unit": "mIU/L"}]},
         {"risk": "insulin_resistance_risk", "summary": "Elevated fasting insulin indicates insulin resistance. Lifestyle modification is first-line.",
          "recommendation_keys": ["insulin_resistance_plan", "homa_ir_lifestyle"]},
         0.76, "moderate", False,
         "Fasting insulin ({{insulin_value}} {{insulin_unit}}) is elevated. Calculate HOMA-IR and correlate with fasting glucose."),

    rule("rule_high_homa_ir", "HOMA-IR — Insulin Resistance",
         "HOMA-IR > 2.5 indicates clinically significant insulin resistance.",
         ["homa_ir"],
         {"all": [{"lab_marker": "homa_ir", "operator": "gt", "value": 2.5, "unit": ""}]},
         {"risk": "insulin_resistance_risk", "summary": "HOMA-IR exceeds 2.5, indicating insulin resistance. Intensive lifestyle intervention recommended.",
          "recommendation_keys": ["homa_ir_lifestyle", "insulin_resistance_plan", "prediabetes_lifestyle"]},
         0.80, "high", False,
         "HOMA-IR of {{homa_ir_value}} exceeds 2.5 — consistent with insulin resistance. Target < 2.0 with lifestyle changes."),

    rule("rule_prediabetes_hba1c", "Prediabetes — HbA1c Range",
         "HbA1c 5.7-6.4% (39-47 mmol/mol) indicates prediabetes requiring intervention.",
         ["hba1c"],
         {"all": [{"lab_marker": "hba1c", "operator": "between", "value": [5.7, 6.4], "unit": "%"}]},
         {"risk": "prediabetes_risk", "summary": "HbA1c in prediabetic range. Intensive lifestyle programme reduces progression to T2DM by ~58%.",
          "recommendation_keys": ["prediabetes_lifestyle", "insulin_resistance_plan"]},
         0.84, "moderate", False,
         "HbA1c ({{hba1c_value}}%) falls in the prediabetic range (5.7-6.4%). Act now to prevent progression."),

    rule("rule_high_fructosamine", "Elevated Fructosamine",
         "Fructosamine > 285 μmol/L suggests poor glycaemic control over the preceding 2-3 weeks.",
         ["fructosamine"],
         {"all": [{"lab_marker": "fructosamine", "operator": "gt", "value": 285, "unit": "μmol/L"}]},
         {"risk": "poor_glucose_control_risk", "summary": "Elevated fructosamine indicates suboptimal glycaemic control in the past 2-3 weeks.",
          "recommendation_keys": ["fructosamine_monitoring", "insulin_resistance_plan"]},
         0.74, "moderate", True,
         "Fructosamine ({{fructosamine_value}} {{fructosamine_unit}}) exceeds 285 μmol/L, suggesting recent hyperglycaemia."),

    # ════════════════════════════════════════════════════════════════════════
    # 3. LIPID PANEL
    # ════════════════════════════════════════════════════════════════════════

    rule("rule_high_total_cholesterol", "High Total Cholesterol",
         "Total cholesterol > 5.0 mmol/L requires CVD risk stratification.",
         ["total_cholesterol"],
         {"all": [{"lab_marker": "total_cholesterol", "operator": "gt", "value": 5.0, "unit": "mmol/L"}]},
         {"risk": "elevated_cardiovascular_risk", "summary": "Total cholesterol above optimal level. Full lipid profile and CVD risk assessment recommended.",
          "recommendation_keys": ["lipid_lifestyle_plan", "statin_consideration"]},
         0.72, "moderate", False,
         "Total cholesterol ({{total_cholesterol_value}} {{total_cholesterol_unit}}) exceeds 5.0 mmol/L. Obtain full fasting lipid profile."),

    rule("rule_very_high_total_cholesterol", "Very High Total Cholesterol",
         "Total cholesterol > 7.5 mmol/L suggests familial hypercholesterolaemia.",
         ["total_cholesterol"],
         {"all": [{"lab_marker": "total_cholesterol", "operator": "gt", "value": 7.5, "unit": "mmol/L"}]},
         {"risk": "familial_hypercholesterolaemia_risk", "summary": "Very high total cholesterol — familial hypercholesterolaemia screening and specialist referral indicated.",
          "recommendation_keys": ["statin_consideration", "lpa_cardiovascular_risk"]},
         0.82, "high", True,
         "Total cholesterol ({{total_cholesterol_value}} {{total_cholesterol_unit}}) exceeds 7.5 mmol/L — consider familial hypercholesterolaemia."),

    rule("rule_high_non_hdl", "Elevated non-HDL Cholesterol",
         "Non-HDL cholesterol > 3.8 mmol/L is a better atherogenic burden marker than LDL alone.",
         ["non_hdl"],
         {"all": [{"lab_marker": "non_hdl", "operator": "gt", "value": 3.8, "unit": "mmol/L"}]},
         {"risk": "atherogenic_burden_risk", "summary": "Non-HDL cholesterol is elevated, reflecting combined LDL and VLDL atherogenic burden.",
          "recommendation_keys": ["lipid_lifestyle_plan", "statin_consideration"]},
         0.76, "moderate", False,
         "Non-HDL cholesterol ({{non_hdl_value}} {{non_hdl_unit}}) exceeds 3.8 mmol/L."),

    rule("rule_high_lpa", "Elevated Lp(a)",
         "Lp(a) > 50 mg/dL is an independent, inherited cardiovascular risk factor.",
         ["lpa"],
         {"all": [{"lab_marker": "lpa", "operator": "gt", "value": 50, "unit": "mg/dL"}]},
         {"risk": "elevated_cardiovascular_risk", "summary": "Elevated Lp(a) is a genetic CVD risk amplifier — intensify conventional risk factor management.",
          "recommendation_keys": ["lpa_cardiovascular_risk", "statin_consideration"]},
         0.80, "high", True,
         "Lp(a) ({{lpa_value}} {{lpa_unit}}) exceeds 50 mg/dL — independent cardiovascular risk factor."),

    rule("rule_high_apob", "Elevated ApoB",
         "ApoB > 130 mg/dL reflects a high atherogenic particle burden.",
         ["apob"],
         {"all": [{"lab_marker": "apob", "operator": "gt", "value": 130, "unit": "mg/dL"}]},
         {"risk": "atherogenic_burden_risk", "summary": "ApoB is elevated — each ApoB particle represents a potentially atherogenic lipoprotein.",
          "recommendation_keys": ["apob_risk_reassessment", "statin_consideration"]},
         0.78, "high", True,
         "ApoB ({{apob_value}} {{apob_unit}}) exceeds 130 mg/dL. ApoB-guided therapy targets < 90 mg/dL for high-risk patients."),

    # ════════════════════════════════════════════════════════════════════════
    # 4. LIVER FUNCTION
    # ════════════════════════════════════════════════════════════════════════

    rule("rule_high_ggt", "Elevated GGT",
         "GGT > 55 U/L in men or > 38 U/L in women suggests hepatobiliary disease or alcohol excess.",
         ["ggt"],
         {"all": [{"lab_marker": "ggt", "operator": "gt", "value": 55, "unit": "U/L"}]},
         {"risk": "hepatobiliary_risk", "summary": "Elevated GGT — most sensitive marker for alcohol use, fatty liver and drug hepatotoxicity.",
          "recommendation_keys": ["ggt_alcohol_screen", "liver_ultrasound"]},
         0.74, "moderate", False,
         "GGT ({{ggt_value}} {{ggt_unit}}) is elevated. Review alcohol intake, medications and obtain abdominal ultrasound if persistent."),

    rule("rule_high_alp", "Elevated ALP",
         "ALP > 120 U/L may indicate biliary obstruction, bone disease or liver infiltration.",
         ["alp"],
         {"all": [{"lab_marker": "alp", "operator": "gt", "value": 120, "unit": "U/L"}]},
         {"risk": "hepatobiliary_or_bone_risk", "summary": "Elevated ALP — differentiate biliary, hepatic and bone origins with GGT and bone isoenzymes.",
          "recommendation_keys": ["alp_biliary_followup", "liver_ultrasound"]},
         0.72, "moderate", True,
         "ALP ({{alp_value}} {{alp_unit}}) is elevated. GGT co-elevation suggests hepatobiliary cause; isolated ALP may be bone-derived."),

    rule("rule_high_bilirubin_total", "Elevated Total Bilirubin",
         "Total bilirubin > 20 μmol/L warrants investigation for haemolysis, liver disease or biliary obstruction.",
         ["bilirubin_total"],
         {"all": [{"lab_marker": "bilirubin_total", "operator": "gt", "value": 20, "unit": "μmol/L"}]},
         {"risk": "jaundice_risk", "summary": "Elevated bilirubin — classify as pre-hepatic, hepatic or post-hepatic and investigate accordingly.",
          "recommendation_keys": ["bilirubin_workup", "liver_ultrasound"]},
         0.78, "moderate", True,
         "Total bilirubin ({{bilirubin_total_value}} {{bilirubin_total_unit}}) is above 20 μmol/L. Jaundice becomes visible typically at > 35 μmol/L."),

    rule("rule_high_direct_bilirubin", "Elevated Direct Bilirubin — Cholestasis",
         "Direct bilirubin > 5 μmol/L suggests hepatocellular damage or biliary obstruction.",
         ["bilirubin_direct"],
         {"all": [{"lab_marker": "bilirubin_direct", "operator": "gt", "value": 5, "unit": "μmol/L"}]},
         {"risk": "cholestasis_risk", "summary": "Elevated direct bilirubin suggests impaired bilirubin conjugation or excretion.",
          "recommendation_keys": ["bilirubin_workup", "liver_ultrasound"]},
         0.76, "moderate", True,
         "Direct bilirubin ({{bilirubin_direct_value}} {{bilirubin_direct_unit}}) is elevated, indicating cholestatic or hepatocellular pathology."),

    rule("rule_low_albumin", "Hypoalbuminaemia",
         "Albumin < 35 g/L reflects impaired hepatic synthesis or protein loss.",
         ["albumin"],
         {"all": [{"lab_marker": "albumin", "operator": "lt", "value": 35, "unit": "g/L"}]},
         {"risk": "hepatic_or_nutritional_risk", "summary": "Low albumin indicates protein deficiency, malnutrition, or impaired liver synthetic function.",
          "recommendation_keys": ["low_albumin_nutrition", "liver_ultrasound"]},
         0.76, "high", True,
         "Albumin ({{albumin_value}} {{albumin_unit}}) is below 35 g/L — assess liver synthetic function and nutritional status."),

    rule("rule_low_total_protein", "Low Total Protein",
         "Total protein < 60 g/L suggests severe malnutrition or protein loss.",
         ["total_protein"],
         {"all": [{"lab_marker": "total_protein", "operator": "lt", "value": 60, "unit": "g/L"}]},
         {"risk": "malnutrition_risk", "summary": "Low total protein reflects significant protein deficit — assess albumin, globulin fractions and nutritional intake.",
          "recommendation_keys": ["low_albumin_nutrition"]},
         0.72, "moderate", True,
         "Total protein ({{total_protein_value}} {{total_protein_unit}}) is below 60 g/L. Fractionate into albumin/globulin and investigate cause."),

    # ════════════════════════════════════════════════════════════════════════
    # 5. KIDNEY FUNCTION
    # ════════════════════════════════════════════════════════════════════════

    rule("rule_elevated_creatinine", "Elevated Creatinine",
         "Creatinine > 110 μmol/L in women or > 125 μmol/L in men may reflect reduced GFR.",
         ["creatinine"],
         {"all": [{"lab_marker": "creatinine", "operator": "gt", "value": 110, "unit": "μmol/L"}]},
         {"risk": "renal_impairment_risk", "summary": "Elevated creatinine — calculate eGFR and assess trend. Exclude pre-renal causes.",
          "recommendation_keys": ["creatinine_trend_monitoring", "ckd_management_plan"]},
         0.76, "moderate", True,
         "Creatinine ({{creatinine_value}} {{creatinine_unit}}) is elevated. eGFR should be calculated; assess hydration and medication nephrotoxicity."),

    rule("rule_low_egfr", "Reduced eGFR — Chronic Kidney Disease",
         "eGFR < 60 mL/min/1.73m² on two occasions ≥ 3 months apart meets CKD criteria.",
         ["egfr"],
         {"all": [{"lab_marker": "egfr", "operator": "lt", "value": 60, "unit": "mL/min/1.73m²"}]},
         {"risk": "ckd_risk", "summary": "Reduced eGFR consistent with CKD if persistent. Nephrology referral and RAAS inhibition if proteinuric.",
          "recommendation_keys": ["ckd_management_plan", "kidney_diet_advice"]},
         0.84, "high", True,
         "eGFR ({{egfr_value}} {{egfr_unit}}) is below 60 mL/min/1.73m². Confirm persistence over ≥ 3 months to establish CKD diagnosis."),

    rule("rule_high_uric_acid", "Hyperuricaemia",
         "Uric acid > 420 μmol/L increases gout risk and may independently predict cardiovascular and renal events.",
         ["uric_acid"],
         {"all": [{"lab_marker": "uric_acid", "operator": "gt", "value": 420, "unit": "μmol/L"}]},
         {"risk": "gout_and_renal_risk", "summary": "Elevated uric acid — dietary modification first-line; consider urate-lowering therapy if recurrent gout.",
          "recommendation_keys": ["uric_acid_lifestyle"]},
         0.76, "moderate", False,
         "Uric acid ({{uric_acid_value}} {{uric_acid_unit}}) exceeds 420 μmol/L. Limit purine-rich foods and increase hydration."),

    rule("rule_elevated_bun", "Elevated Blood Urea Nitrogen",
         "BUN > 7.5 mmol/L may reflect dehydration, high protein intake or pre-renal azotaemia.",
         ["bun"],
         {"all": [{"lab_marker": "bun", "operator": "gt", "value": 7.5, "unit": "mmol/L"}]},
         {"risk": "dehydration_or_renal_risk", "summary": "Elevated BUN — assess hydration status and correlate with creatinine (BUN:Cr ratio).",
          "recommendation_keys": ["bun_hydration_check"]},
         0.68, "moderate", False,
         "BUN ({{bun_value}} {{bun_unit}}) is elevated. BUN:creatinine ratio > 20 suggests pre-renal azotaemia."),

    rule("rule_high_cystatin_c", "Elevated Cystatin C — Renal Filtration",
         "Cystatin C > 1.0 mg/L is a sensitive GFR marker unaffected by muscle mass.",
         ["cystatin_c"],
         {"all": [{"lab_marker": "cystatin_c", "operator": "gt", "value": 1.0, "unit": "mg/L"}]},
         {"risk": "renal_impairment_risk", "summary": "Elevated cystatin C indicates reduced glomerular filtration rate, independent of muscle mass.",
          "recommendation_keys": ["ckd_management_plan", "creatinine_trend_monitoring"]},
         0.78, "moderate", True,
         "Cystatin C ({{cystatin_c_value}} {{cystatin_c_unit}}) is above 1.0 mg/L. Particularly useful in early CKD detection."),

    # ════════════════════════════════════════════════════════════════════════
    # 6. THYROID
    # ════════════════════════════════════════════════════════════════════════

    rule("rule_low_free_t4", "Low Free T4 — Hypothyroidism",
         "Free T4 below normal with elevated TSH indicates overt primary hypothyroidism.",
         ["free_t4"],
         {"all": [{"lab_marker": "free_t4", "operator": "lt", "value": 12, "unit": "pmol/L"}]},
         {"risk": "hypothyroidism_risk", "summary": "Low free T4 confirms overt hypothyroidism when TSH is elevated.",
          "recommendation_keys": ["hypothyroid_treatment_review", "thyroid_antibody_monitoring"]},
         0.84, "high", True,
         "Free T4 ({{free_t4_value}} {{free_t4_unit}}) is below 12 pmol/L. Initiate levothyroxine therapy after excluding secondary hypothyroidism."),

    rule("rule_high_free_t4", "High Free T4 — Hyperthyroidism",
         "Free T4 > 22 pmol/L with suppressed TSH indicates hyperthyroidism.",
         ["free_t4"],
         {"all": [{"lab_marker": "free_t4", "operator": "gt", "value": 22, "unit": "pmol/L"}]},
         {"risk": "hyperthyroidism_risk", "summary": "Elevated free T4 consistent with hyperthyroidism — specialist workup required.",
          "recommendation_keys": ["hyperthyroid_referral"]},
         0.84, "high", True,
         "Free T4 ({{free_t4_value}} {{free_t4_unit}}) is elevated. Anti-TSH receptor antibodies and radionuclide scan to identify cause."),

    rule("rule_high_free_t3", "High Free T3 — T3 Toxicosis",
         "Free T3 > 6.0 pmol/L with suppressed TSH may indicate T3 toxicosis or early hyperthyroidism.",
         ["free_t3"],
         {"all": [{"lab_marker": "free_t3", "operator": "gt", "value": 6.0, "unit": "pmol/L"}]},
         {"risk": "hyperthyroidism_risk", "summary": "Elevated free T3 may precede free T4 elevation in early or T3-predominant hyperthyroidism.",
          "recommendation_keys": ["hyperthyroid_referral", "free_t3_t4_interpretation"]},
         0.76, "high", True,
         "Free T3 ({{free_t3_value}} {{free_t3_unit}}) is elevated. Correlate with TSH and free T4."),

    rule("rule_low_free_t3", "Low Free T3",
         "Low free T3 occurs in severe illness, starvation or hypothyroidism (euthyroid sick syndrome).",
         ["free_t3"],
         {"all": [{"lab_marker": "free_t3", "operator": "lt", "value": 3.5, "unit": "pmol/L"}]},
         {"risk": "thyroid_or_systemic_illness_risk", "summary": "Low free T3 may indicate euthyroid sick syndrome or overt hypothyroidism.",
          "recommendation_keys": ["free_t3_t4_interpretation", "hypothyroid_treatment_review"]},
         0.70, "moderate", True,
         "Free T3 ({{free_t3_value}} {{free_t3_unit}}) is low. In acute illness this may be adaptive; assess clinical context and TSH."),

    rule("rule_high_anti_tpo", "Positive Anti-TPO — Hashimoto's",
         "Anti-TPO antibodies > 35 IU/mL indicate autoimmune thyroiditis (Hashimoto's disease).",
         ["anti_tpo"],
         {"all": [{"lab_marker": "anti_tpo", "operator": "gt", "value": 35, "unit": "IU/mL"}]},
         {"risk": "autoimmune_thyroid_risk", "summary": "Positive anti-TPO antibodies indicate Hashimoto's autoimmune thyroiditis. Annual TSH monitoring required.",
          "recommendation_keys": ["thyroid_antibody_monitoring", "subclinical_thyroid_plan"]},
         0.80, "moderate", True,
         "Anti-TPO ({{anti_tpo_value}} {{anti_tpo_unit}}) exceeds 35 IU/mL. Hashimoto's thyroiditis is the most common autoimmune thyroid disorder."),

    rule("rule_high_anti_tg", "Positive Anti-Thyroglobulin",
         "Anti-TG > 40 IU/mL may indicate autoimmune thyroid disease.",
         ["anti_tg"],
         {"all": [{"lab_marker": "anti_tg", "operator": "gt", "value": 40, "unit": "IU/mL"}]},
         {"risk": "autoimmune_thyroid_risk", "summary": "Positive anti-TG antibodies — correlate with anti-TPO and TSH. Used also for thyroid cancer monitoring.",
          "recommendation_keys": ["thyroid_antibody_monitoring"]},
         0.72, "moderate", True,
         "Anti-TG ({{anti_tg_value}} {{anti_tg_unit}}) exceeds 40 IU/mL. Autoimmune thyroid disease most likely; correlate clinically."),

    # ════════════════════════════════════════════════════════════════════════
    # 7. VITAMINS & MINERALS
    # ════════════════════════════════════════════════════════════════════════

    rule("rule_low_b12", "Vitamin B12 Deficiency",
         "B12 < 200 pmol/L may cause megaloblastic anaemia, neuropathy and cognitive impairment.",
         ["vitamin_b12"],
         {"all": [{"lab_marker": "vitamin_b12", "operator": "lt", "value": 200, "unit": "pmol/L"}]},
         {"risk": "b12_deficiency_risk", "summary": "Vitamin B12 deficiency — supplementation and investigation of underlying cause required.",
          "recommendation_keys": ["b12_supplementation", "anemia_workup"]},
         0.82, "high", False,
         "Vitamin B12 ({{vitamin_b12_value}} {{vitamin_b12_unit}}) is below 200 pmol/L. Risk of anaemia and neurological complications."),

    rule("rule_borderline_low_b12", "Borderline Vitamin B12",
         "B12 200-300 pmol/L is borderline; consider methylmalonic acid / homocysteine for functional deficiency.",
         ["vitamin_b12"],
         {"all": [{"lab_marker": "vitamin_b12", "operator": "between", "value": [200, 300], "unit": "pmol/L"}]},
         {"risk": "borderline_b12_risk", "summary": "Borderline B12 — functional deficiency possible despite seemingly normal level.",
          "recommendation_keys": ["b12_supplementation"]},
         0.68, "moderate", False,
         "B12 ({{vitamin_b12_value}} pmol/L) is borderline. Measure MMA and homocysteine if symptomatic."),

    rule("rule_low_folate", "Folate Deficiency",
         "Serum folate < 10 nmol/L or RBC folate < 340 nmol/L indicates deficiency.",
         ["folate"],
         {"all": [{"lab_marker": "folate", "operator": "lt", "value": 10, "unit": "nmol/L"}]},
         {"risk": "folate_deficiency_risk", "summary": "Folate deficiency — supplement and increase dietary intake. Critical in pregnancy.",
          "recommendation_keys": ["folate_supplementation", "anemia_workup"]},
         0.80, "moderate", False,
         "Serum folate ({{folate_value}} {{folate_unit}}) is below 10 nmol/L. Risk of macrocytic anaemia and neural tube defects in pregnancy."),

    rule("rule_low_zinc", "Zinc Deficiency",
         "Zinc < 10 μmol/L is associated with impaired immunity, wound healing and taste disturbance.",
         ["zinc"],
         {"all": [{"lab_marker": "zinc", "operator": "lt", "value": 10, "unit": "μmol/L"}]},
         {"risk": "zinc_deficiency_risk", "summary": "Low zinc impairs immune function, wound healing and reproductive health.",
          "recommendation_keys": ["zinc_supplementation"]},
         0.70, "moderate", False,
         "Zinc ({{zinc_value}} {{zinc_unit}}) is below 10 μmol/L. Supplement and review dietary sources (meat, shellfish, nuts, seeds)."),

    rule("rule_low_magnesium", "Magnesium Deficiency",
         "Magnesium < 0.7 mmol/L is associated with muscle cramps, arrhythmia and insulin resistance.",
         ["magnesium"],
         {"all": [{"lab_marker": "magnesium", "operator": "lt", "value": 0.7, "unit": "mmol/L"}]},
         {"risk": "magnesium_deficiency_risk", "summary": "Low magnesium may cause muscle cramps, fatigue, arrhythmia and increased insulin resistance.",
          "recommendation_keys": ["magnesium_repletion"]},
         0.78, "moderate", False,
         "Magnesium ({{magnesium_value}} {{magnesium_unit}}) is below 0.7 mmol/L. Serum magnesium underestimates intracellular stores."),

    rule("rule_low_selenium", "Selenium Insufficiency",
         "Selenium < 70 μg/L may impair thyroid function and antioxidant defence.",
         ["selenium"],
         {"all": [{"lab_marker": "selenium", "operator": "lt", "value": 70, "unit": "μg/L"}]},
         {"risk": "selenium_deficiency_risk", "summary": "Low selenium impairs thyroid deiodinase function and glutathione peroxidase activity.",
          "recommendation_keys": ["selenium_status_review"]},
         0.68, "moderate", False,
         "Selenium ({{selenium_value}} {{selenium_unit}}) is below 70 μg/L. Particularly important for thyroid health."),

    rule("rule_low_copper", "Copper Deficiency",
         "Copper < 11 μmol/L may cause anaemia, leukopenia and neurological dysfunction.",
         ["copper"],
         {"all": [{"lab_marker": "copper", "operator": "lt", "value": 11, "unit": "μmol/L"}]},
         {"risk": "copper_deficiency_risk", "summary": "Low copper can mimic B12 deficiency with haematological and neurological manifestations.",
          "recommendation_keys": ["copper_status_review", "anemia_workup"]},
         0.72, "moderate", True,
         "Copper ({{copper_value}} {{copper_unit}}) is below 11 μmol/L. Assess for excessive zinc supplementation and malabsorption."),

    rule("rule_high_copper", "Elevated Copper — Wilson's Disease Screen",
         "Copper > 24 μmol/L may indicate Wilson's disease or inflammatory response.",
         ["copper"],
         {"all": [{"lab_marker": "copper", "operator": "gt", "value": 24, "unit": "μmol/L"}]},
         {"risk": "copper_overload_risk", "summary": "Elevated copper — exclude Wilson's disease with serum ceruloplasmin and 24h urine copper.",
          "recommendation_keys": ["copper_status_review"]},
         0.72, "high", True,
         "Copper ({{copper_value}} {{copper_unit}}) is elevated. Wilson's disease screen: ceruloplasmin, slit-lamp exam and urine copper."),

    rule("rule_low_vitamin_a", "Vitamin A Deficiency",
         "Vitamin A < 0.7 μmol/L impairs immunity, vision and epithelial integrity.",
         ["vitamin_a"],
         {"all": [{"lab_marker": "vitamin_a", "operator": "lt", "value": 0.7, "unit": "μmol/L"}]},
         {"risk": "vitamin_a_deficiency_risk", "summary": "Low vitamin A affects night vision, immunity and epithelial barrier function.",
          "recommendation_keys": ["vitamin_a_review"]},
         0.70, "moderate", True,
         "Vitamin A ({{vitamin_a_value}} {{vitamin_a_unit}}) is below the recommended threshold. Supplementation requires medical supervision."),

    rule("rule_low_vitamin_e", "Vitamin E Insufficiency",
         "Vitamin E < 12 μmol/L may impair antioxidant defences and immune function.",
         ["vitamin_e"],
         {"all": [{"lab_marker": "vitamin_e", "operator": "lt", "value": 12, "unit": "μmol/L"}]},
         {"risk": "vitamin_e_insufficiency_risk", "summary": "Low vitamin E — increase dietary sources. Supplementation at high doses not recommended.",
          "recommendation_keys": ["vitamin_e_antioxidant"]},
         0.62, "low", False,
         "Vitamin E ({{vitamin_e_value}} {{vitamin_e_unit}}) is below 12 μmol/L."),

    # ════════════════════════════════════════════════════════════════════════
    # 8. INFLAMMATION
    # ════════════════════════════════════════════════════════════════════════

    rule("rule_high_crp", "Elevated CRP — Active Inflammation",
         "CRP > 10 mg/L indicates significant active infection or inflammation.",
         ["crp"],
         {"all": [{"lab_marker": "crp", "operator": "gt", "value": 10, "unit": "mg/L"}]},
         {"risk": "active_inflammation_risk", "summary": "CRP is significantly elevated — active infection or systemic inflammation requires clinical assessment.",
          "recommendation_keys": ["crp_infection_screen"]},
         0.82, "high", True,
         "CRP ({{crp_value}} {{crp_unit}}) exceeds 10 mg/L. Investigate source of infection or inflammation urgently."),

    rule("rule_elevated_hs_crp", "Elevated hs-CRP — Cardiovascular Risk",
         "hs-CRP 1-3 mg/L = intermediate CVD risk; > 3 mg/L = high vascular risk marker.",
         ["hs_crp"],
         {"all": [{"lab_marker": "hs_crp", "operator": "gt", "value": 1.0, "unit": "mg/L"}]},
         {"risk": "cardiovascular_inflammatory_risk", "summary": "Elevated hs-CRP predicts cardiovascular events independently of lipids. Anti-inflammatory lifestyle modifications recommended.",
          "recommendation_keys": ["hs_crp_cvd_risk", "lipid_lifestyle_plan"]},
         0.76, "moderate", False,
         "hs-CRP ({{hs_crp_value}} {{hs_crp_unit}}) is elevated. Target < 1.0 mg/L with anti-inflammatory lifestyle."),

    rule("rule_high_homocysteine", "Hyperhomocysteinaemia",
         "Homocysteine > 15 μmol/L is associated with atherosclerosis, VTE and cognitive decline.",
         ["homocysteine"],
         {"all": [{"lab_marker": "homocysteine", "operator": "gt", "value": 15, "unit": "μmol/L"}]},
         {"risk": "cardiovascular_and_cognitive_risk", "summary": "Elevated homocysteine is an independent CVD risk factor — B-vitamin supplementation effectively lowers levels.",
          "recommendation_keys": ["homocysteine_reduction"]},
         0.76, "moderate", False,
         "Homocysteine ({{homocysteine_value}} {{homocysteine_unit}}) exceeds 15 μmol/L. Folate, B6 and B12 supplementation reduces levels by ~25-30%."),

    rule("rule_high_esr", "Elevated ESR",
         "ESR > 30 mm/h in men or > 40 mm/h in women suggests systemic inflammation or haematological disease.",
         ["esr"],
         {"all": [{"lab_marker": "esr", "operator": "gt", "value": 40, "unit": "mm/h"}]},
         {"risk": "systemic_inflammation_risk", "summary": "Elevated ESR is a non-specific marker — correlate with CRP, clinical symptoms and CBC.",
          "recommendation_keys": ["esr_followup"]},
         0.68, "moderate", True,
         "ESR ({{esr_value}} {{esr_unit}}) is elevated. Persistent elevation without explanation warrants specialist referral."),

    rule("rule_high_fibrinogen", "Elevated Fibrinogen",
         "Fibrinogen > 4 g/L is a pro-thrombotic and pro-inflammatory risk marker.",
         ["fibrinogen"],
         {"all": [{"lab_marker": "fibrinogen", "operator": "gt", "value": 4.0, "unit": "g/L"}]},
         {"risk": "thrombotic_and_cvd_risk", "summary": "Elevated fibrinogen increases cardiovascular and thrombotic risk — address modifiable lifestyle factors.",
          "recommendation_keys": ["fibrinogen_cvd_risk"]},
         0.72, "moderate", False,
         "Fibrinogen ({{fibrinogen_value}} {{fibrinogen_unit}}) exceeds 4 g/L. Smoking cessation, exercise and weight loss reduce fibrinogen."),

    # ════════════════════════════════════════════════════════════════════════
    # 9. SEX HORMONES
    # ════════════════════════════════════════════════════════════════════════

    rule("rule_low_testosterone", "Low Total Testosterone",
         "Total testosterone < 10 nmol/L (288 ng/dL) in men suggests hypogonadism.",
         ["testosterone"],
         {"all": [{"lab_marker": "testosterone", "operator": "lt", "value": 10, "unit": "nmol/L"}]},
         {"risk": "hypogonadism_risk", "summary": "Low testosterone — confirm with repeat morning fasting sample and LH/FSH to classify aetiology.",
          "recommendation_keys": ["testosterone_optimisation", "lh_fsh_pituitary_review"]},
         0.80, "high", True,
         "Testosterone ({{testosterone_value}} {{testosterone_unit}}) is below 10 nmol/L. Evaluate LH/FSH to classify as primary vs secondary hypogonadism."),

    rule("rule_low_free_testosterone", "Low Free Testosterone",
         "Free testosterone < 225 pmol/L may cause symptoms despite normal total testosterone.",
         ["free_testosterone"],
         {"all": [{"lab_marker": "free_testosterone", "operator": "lt", "value": 225, "unit": "pmol/L"}]},
         {"risk": "hypogonadism_risk", "summary": "Low free testosterone — often related to high SHBG. Assess SHBG, albumin and total testosterone.",
          "recommendation_keys": ["testosterone_optimisation", "shbg_metabolic_link"]},
         0.74, "moderate", True,
         "Free testosterone ({{free_testosterone_value}} {{free_testosterone_unit}}) is low. SHBG elevation can reduce bioavailable testosterone despite normal total levels."),

    rule("rule_high_shbg", "Elevated SHBG",
         "SHBG > 70 nmol/L reduces bioavailable testosterone and oestrogen.",
         ["shbg"],
         {"all": [{"lab_marker": "shbg", "operator": "gt", "value": 70, "unit": "nmol/L"}]},
         {"risk": "reduced_bioavailable_hormones_risk", "summary": "High SHBG reduces bioavailable sex hormones — assess free testosterone/oestradiol.",
          "recommendation_keys": ["shbg_metabolic_link", "testosterone_optimisation"]},
         0.70, "moderate", True,
         "SHBG ({{shbg_value}} {{shbg_unit}}) is elevated. Calculate free/bioavailable testosterone to assess androgen sufficiency."),

    rule("rule_low_shbg", "Low SHBG — Metabolic Syndrome Link",
         "SHBG < 25 nmol/L is associated with insulin resistance, obesity and type 2 diabetes risk.",
         ["shbg"],
         {"all": [{"lab_marker": "shbg", "operator": "lt", "value": 25, "unit": "nmol/L"}]},
         {"risk": "metabolic_syndrome_risk", "summary": "Low SHBG is a marker of insulin resistance and metabolic syndrome. Lifestyle intervention indicated.",
          "recommendation_keys": ["shbg_metabolic_link", "insulin_resistance_plan"]},
         0.74, "moderate", False,
         "SHBG ({{shbg_value}} {{shbg_unit}}) is below 25 nmol/L. Low SHBG is strongly associated with metabolic dysfunction."),

    rule("rule_low_estradiol", "Low Oestradiol",
         "Oestradiol < 100 pmol/L (follicular/non-cycling) may indicate menopause, premature ovarian insufficiency or hypothalamic amenorrhoea.",
         ["estradiol"],
         {"all": [{"lab_marker": "estradiol", "operator": "lt", "value": 100, "unit": "pmol/L"}]},
         {"risk": "oestrogen_deficiency_risk", "summary": "Low oestradiol — assess menopausal status, cycle phase and LH/FSH to identify cause.",
          "recommendation_keys": ["estradiol_followup", "lh_fsh_pituitary_review"]},
         0.72, "moderate", True,
         "Oestradiol ({{estradiol_value}} {{estradiol_unit}}) is below 100 pmol/L. Correlate with menstrual cycle phase, LH, FSH and symptoms."),

    rule("rule_high_estradiol_male", "Elevated Oestradiol in Males",
         "Oestradiol > 150 pmol/L in men may cause gynaecomastia and suppress gonadotropins.",
         ["estradiol"],
         {"all": [{"lab_marker": "estradiol", "operator": "gt", "value": 150, "unit": "pmol/L"}]},
         {"risk": "hyperoestrogenaemia_risk", "summary": "Elevated oestradiol in a male context suggests obesity (peripheral aromatisation), liver disease, or exogenous oestrogen source.",
          "recommendation_keys": ["estradiol_followup", "testosterone_optimisation"]},
         0.70, "moderate", True,
         "Oestradiol ({{estradiol_value}} {{estradiol_unit}}) is above 150 pmol/L. Assess BMI, liver function and exogenous hormone use."),

    rule("rule_low_progesterone_luteal", "Low Progesterone — Anovulation Risk",
         "Mid-luteal progesterone < 30 nmol/L suggests absent or inadequate ovulation.",
         ["progesterone"],
         {"all": [{"lab_marker": "progesterone", "operator": "lt", "value": 30, "unit": "nmol/L"}]},
         {"risk": "anovulation_risk", "summary": "Low mid-luteal progesterone suggests anovulation — track with BBT and LH surge.",
          "recommendation_keys": ["progesterone_monitoring", "lh_fsh_pituitary_review"]},
         0.74, "moderate", True,
         "Progesterone ({{progesterone_value}} {{progesterone_unit}}) is below 30 nmol/L at mid-luteal phase, suggesting possible anovulation."),

    rule("rule_low_amh", "Low AMH — Diminished Ovarian Reserve",
         "AMH < 1 ng/mL indicates diminished ovarian reserve.",
         ["amh"],
         {"all": [{"lab_marker": "amh", "operator": "lt", "value": 1.0, "unit": "ng/mL"}]},
         {"risk": "diminished_ovarian_reserve_risk", "summary": "Low AMH — reproductive endocrinology consultation recommended if pregnancy is desired.",
          "recommendation_keys": ["amh_fertility_counselling"]},
         0.80, "high", True,
         "AMH ({{amh_value}} {{amh_unit}}) is below 1 ng/mL — diminished ovarian reserve. Discuss fertility planning urgently."),

    rule("rule_high_lh", "Elevated LH",
         "LH > 40 IU/L in a pre-menopausal woman or > 20 IU/L outside luteal surge suggests primary ovarian failure or PCOS.",
         ["lh"],
         {"all": [{"lab_marker": "lh", "operator": "gt", "value": 40, "unit": "IU/L"}]},
         {"risk": "gonadal_axis_disruption_risk", "summary": "Elevated LH — correlate with FSH and oestradiol to distinguish primary from central causes.",
          "recommendation_keys": ["lh_fsh_pituitary_review", "estradiol_followup"]},
         0.76, "high", True,
         "LH ({{lh_value}} {{lh_unit}}) is elevated. Sustained elevation may indicate primary gonadal failure or peri-menopausal transition."),

    rule("rule_high_fsh", "Elevated FSH",
         "FSH > 25 IU/L suggests primary gonadal failure or peri-menopause.",
         ["fsh"],
         {"all": [{"lab_marker": "fsh", "operator": "gt", "value": 25, "unit": "IU/L"}]},
         {"risk": "gonadal_failure_risk", "summary": "Elevated FSH (with low AMH and oestradiol) consistent with primary ovarian insufficiency or menopause.",
          "recommendation_keys": ["lh_fsh_pituitary_review", "amh_fertility_counselling"]},
         0.80, "high", True,
         "FSH ({{fsh_value}} {{fsh_unit}}) is elevated. Pituitary is signalling maximally to compensate for gonadal insufficiency."),

    rule("rule_high_prolactin", "Hyperprolactinaemia",
         "Prolactin > 700 mIU/L requires workup to exclude pituitary adenoma and medication causes.",
         ["prolactin"],
         {"all": [{"lab_marker": "prolactin", "operator": "gt", "value": 700, "unit": "mIU/L"}]},
         {"risk": "hyperprolactinaemia_risk", "summary": "Elevated prolactin — exclude stress artifact, then assess medications, hypothyroidism and pituitary pathology.",
          "recommendation_keys": ["prolactin_followup"]},
         0.78, "high", True,
         "Prolactin ({{prolactin_value}} {{prolactin_unit}}) exceeds 700 mIU/L. Macroprolactin exclusion and pituitary MRI if confirmed."),

    # ════════════════════════════════════════════════════════════════════════
    # 10. ADRENAL / CORTISOL / DHEA-S
    # ════════════════════════════════════════════════════════════════════════

    rule("rule_low_cortisol", "Low Morning Cortisol — Adrenal Insufficiency",
         "Morning cortisol < 138 nmol/L suggests adrenal insufficiency — urgent Synacthen test required.",
         ["cortisol"],
         {"all": [{"lab_marker": "cortisol", "operator": "lt", "value": 138, "unit": "nmol/L"}]},
         {"risk": "adrenal_insufficiency_risk", "summary": "Low cortisol — adrenal insufficiency possible. Short Synacthen test required urgently.",
          "recommendation_keys": ["cortisol_adrenal_review"]},
         0.82, "high", True,
         "Cortisol ({{cortisol_value}} {{cortisol_unit}}) is below 138 nmol/L — adrenal reserve may be impaired. Urgent SST indicated."),

    rule("rule_high_cortisol", "Elevated Cortisol — Cushing's Screen",
         "Cortisol > 700 nmol/L (morning) may indicate Cushing's syndrome or severe stress.",
         ["cortisol"],
         {"all": [{"lab_marker": "cortisol", "operator": "gt", "value": 700, "unit": "nmol/L"}]},
         {"risk": "hypercortisolaemia_risk", "summary": "Elevated cortisol — exclude Cushing's with 24h UFC or late-night salivary cortisol before confirming pathology.",
          "recommendation_keys": ["cortisol_adrenal_review", "stress_cortisol_management"]},
         0.74, "moderate", True,
         "Cortisol ({{cortisol_value}} {{cortisol_unit}}) is elevated. Exclude physiological stress and medication effects before pursuing Cushing's workup."),

    rule("rule_high_cortisol_with_stress_symptoms", "High Cortisol with Stress Symptoms",
         "Elevated cortisol with reported stress or sleep disturbance suggests HPA axis activation.",
         ["cortisol"],
         {"any": [
             {"lab_marker": "cortisol", "operator": "gt", "value": 550, "unit": "nmol/L"},
             {"symptom": "poor sleep"},
             {"symptom": "anxiety"},
         ]},
         {"risk": "chronic_stress_hpa_activation", "summary": "Cortisol elevation in the context of stress symptoms warrants lifestyle-based HPA axis regulation.",
          "recommendation_keys": ["stress_cortisol_management"]},
         0.70, "moderate", False,
         "Cortisol ({{cortisol_value}} nmol/L) elevated in context of stress symptoms — structured relaxation and sleep hygiene recommended."),

    rule("rule_low_dhea_s", "Low DHEA-S — Adrenal Androgen Decline",
         "DHEA-S < 2.2 μmol/L may reflect adrenal insufficiency or physiological ageing.",
         ["dhea_s"],
         {"all": [{"lab_marker": "dhea_s", "operator": "lt", "value": 2.2, "unit": "μmol/L"}]},
         {"risk": "adrenal_androgen_deficiency_risk", "summary": "Low DHEA-S may reflect adrenal ageing or insufficiency — correlate with cortisol and clinical picture.",
          "recommendation_keys": ["dhea_s_adrenal_review"]},
         0.68, "moderate", True,
         "DHEA-S ({{dhea_s_value}} {{dhea_s_unit}}) is below 2.2 μmol/L. Assess adrenal function with morning cortisol and SST."),

    rule("rule_high_dhea_s_female", "Elevated DHEA-S in Women",
         "DHEA-S > 12 μmol/L in women suggests adrenal androgen excess — screen for CAH and adrenal tumour.",
         ["dhea_s"],
         {"all": [{"lab_marker": "dhea_s", "operator": "gt", "value": 12, "unit": "μmol/L"}]},
         {"risk": "adrenal_androgen_excess_risk", "summary": "High DHEA-S in women — exclude congenital adrenal hyperplasia and adrenal neoplasm.",
          "recommendation_keys": ["dhea_s_adrenal_review"]},
         0.76, "high", True,
         "DHEA-S ({{dhea_s_value}} {{dhea_s_unit}}) is elevated in a female context — 17-OHP and adrenal imaging may be indicated."),

    # ════════════════════════════════════════════════════════════════════════
    # 11. CARDIAC MARKERS
    # ════════════════════════════════════════════════════════════════════════

    rule("rule_elevated_bnp", "Elevated BNP — Cardiac Stress",
         "BNP > 100 pg/mL suggests cardiac volume/pressure overload — heart failure, PE or AF.",
         ["bnp"],
         {"all": [{"lab_marker": "bnp", "operator": "gt", "value": 100, "unit": "pg/mL"}]},
         {"risk": "cardiac_stress_risk", "summary": "Elevated BNP indicates cardiac stress — urgent echocardiography and cardiology referral.",
          "recommendation_keys": ["bnp_cardiac_review"]},
         0.82, "high", True,
         "BNP ({{bnp_value}} {{bnp_unit}}) exceeds 100 pg/mL. Cardiology assessment and echo required."),

    rule("rule_elevated_nt_probnp", "Elevated NT-proBNP — Heart Failure",
         "NT-proBNP > 300 pg/mL (age-adjusted) suggests cardiac dysfunction.",
         ["nt_probnp"],
         {"all": [{"lab_marker": "nt_probnp", "operator": "gt", "value": 300, "unit": "pg/mL"}]},
         {"risk": "heart_failure_risk", "summary": "Elevated NT-proBNP — age-adjusted interpretation required. Cardiology referral and imaging.",
          "recommendation_keys": ["bnp_cardiac_review"]},
         0.82, "high", True,
         "NT-proBNP ({{nt_probnp_value}} {{nt_probnp_unit}}) is elevated. Rule out decompensated heart failure."),

    rule("rule_elevated_troponin_i", "Elevated Troponin I — Cardiac Injury",
         "Any troponin I elevation above assay URL suggests myocardial injury — ACS must be excluded.",
         ["troponin_i"],
         {"all": [{"lab_marker": "troponin_i", "operator": "gt", "value": 0.04, "unit": "ng/mL"}]},
         {"risk": "myocardial_injury_risk", "summary": "Elevated troponin I — urgent ACS workup with serial ECG and troponin measurements.",
          "recommendation_keys": ["troponin_urgent_referral"]},
         0.92, "critical", True,
         "Troponin I ({{troponin_i_value}} {{troponin_i_unit}}) is above URL. NSTEMI or unstable angina must be excluded urgently."),

    rule("rule_elevated_ck", "Elevated CK — Muscle Injury",
         "CK > 3× ULN (> 600 U/L) suggests rhabdomyolysis, statin myopathy or inflammatory myositis.",
         ["ck"],
         {"all": [{"lab_marker": "ck", "operator": "gt", "value": 600, "unit": "U/L"}]},
         {"risk": "muscle_damage_risk", "summary": "Significantly elevated CK — exclude rhabdomyolysis, statin myopathy and myositis.",
          "recommendation_keys": ["ck_muscle_damage_review"]},
         0.76, "high", True,
         "CK ({{ck_value}} {{ck_unit}}) is elevated > 600 U/L. Assess for rhabdomyolysis: urine myoglobin, renal function."),

    rule("rule_elevated_ldh", "Elevated LDH",
         "LDH > 280 U/L is non-specific but may indicate haemolysis, liver disease, pulmonary embolism or malignancy.",
         ["ldh"],
         {"all": [{"lab_marker": "ldh", "operator": "gt", "value": 280, "unit": "U/L"}]},
         {"risk": "tissue_damage_risk", "summary": "Elevated LDH — non-specific marker of tissue damage. Correlate with clinical context and other markers.",
          "recommendation_keys": ["ck_muscle_damage_review"]},
         0.64, "moderate", True,
         "LDH ({{ldh_value}} {{ldh_unit}}) is elevated. LDH isoenzymes can help localise the source (cardiac, liver, haematological)."),

    # ════════════════════════════════════════════════════════════════════════
    # 12. COAGULATION
    # ════════════════════════════════════════════════════════════════════════

    rule("rule_high_inr", "Elevated INR — Anticoagulation",
         "INR > 3.5 (in anticoagulated patients) or > 1.5 (in non-anticoagulated) indicates coagulopathy.",
         ["inr"],
         {"all": [{"lab_marker": "inr", "operator": "gt", "value": 1.5, "unit": ""}]},
         {"risk": "coagulopathy_risk", "summary": "Elevated INR — assess anticoagulant therapy, liver function and vitamin K status.",
          "recommendation_keys": ["inr_anticoagulation_review"]},
         0.80, "high", True,
         "INR ({{inr_value}}) is elevated. If on warfarin: dose review. If not: assess liver function and coagulation factor deficiencies."),

    rule("rule_high_d_dimer", "Elevated D-dimer — VTE Screen",
         "D-dimer > 500 μg/L (FEU) warrants clinical VTE pre-test probability assessment.",
         ["d_dimer"],
         {"all": [{"lab_marker": "d_dimer", "operator": "gt", "value": 500, "unit": "μg/L"}]},
         {"risk": "vte_risk", "summary": "Elevated D-dimer — sensitive but non-specific. Proceed to imaging if pre-test probability is intermediate/high.",
          "recommendation_keys": ["d_dimer_thrombosis_screen"]},
         0.76, "high", True,
         "D-dimer ({{d_dimer_value}} {{d_dimer_unit}}) is above 500 μg/L. Apply Wells or Geneva score to guide imaging decision."),

    rule("rule_prolonged_aptt", "Prolonged aPTT",
         "aPTT > 40 seconds (without heparin) suggests factor deficiency, LA or haemophilia.",
         ["aptt"],
         {"all": [{"lab_marker": "aptt", "operator": "gt", "value": 40, "unit": "s"}]},
         {"risk": "coagulation_factor_deficiency_risk", "summary": "Prolonged aPTT — exclude heparin effect, factor VIII/IX deficiency and lupus anticoagulant.",
          "recommendation_keys": ["aptt_bleed_risk_review"]},
         0.76, "high", True,
         "aPTT ({{aptt_value}} {{aptt_unit}}) is prolonged. Mixing study will help distinguish factor deficiency from inhibitor."),

    # ════════════════════════════════════════════════════════════════════════
    # 13. ELECTROLYTES
    # ════════════════════════════════════════════════════════════════════════

    rule("rule_low_sodium", "Hyponatraemia",
         "Sodium < 135 mmol/L — assess volume status, urine sodium and osmolality to identify cause.",
         ["sodium"],
         {"all": [{"lab_marker": "sodium", "operator": "lt", "value": 135, "unit": "mmol/L"}]},
         {"risk": "hyponatraemia_risk", "summary": "Low sodium — identify cause (SIADH, heart failure, hypothyroidism) before correcting.",
          "recommendation_keys": ["hyponatremia_workup"]},
         0.82, "high", True,
         "Sodium ({{sodium_value}} {{sodium_unit}}) is below 135 mmol/L. Rapid correction risks osmotic demyelination syndrome."),

    rule("rule_high_sodium", "Hypernatraemia",
         "Sodium > 145 mmol/L indicates hypertonicity — most commonly from dehydration.",
         ["sodium"],
         {"all": [{"lab_marker": "sodium", "operator": "gt", "value": 145, "unit": "mmol/L"}]},
         {"risk": "hypernatraemia_risk", "summary": "High sodium — increase free water intake. Investigate for diabetes insipidus if not dehydration-related.",
          "recommendation_keys": ["bun_hydration_check"]},
         0.76, "high", True,
         "Sodium ({{sodium_value}} {{sodium_unit}}) is above 145 mmol/L. Correct with hypotonic fluids slowly to avoid cerebral oedema."),

    rule("rule_low_potassium", "Hypokalaemia",
         "Potassium < 3.5 mmol/L increases risk of cardiac arrhythmia and muscle weakness.",
         ["potassium"],
         {"all": [{"lab_marker": "potassium", "operator": "lt", "value": 3.5, "unit": "mmol/L"}]},
         {"risk": "hypokalaemia_risk", "summary": "Low potassium — cardiac arrhythmia risk. Replace orally or IV depending on severity.",
          "recommendation_keys": ["hypokalemia_correction"]},
         0.82, "high", True,
         "Potassium ({{potassium_value}} {{potassium_unit}}) is below 3.5 mmol/L. Identify and treat underlying cause."),

    rule("rule_high_potassium", "Hyperkalaemia",
         "Potassium > 5.5 mmol/L can cause fatal arrhythmias — exclude haemolysis, then assess renal function.",
         ["potassium"],
         {"all": [{"lab_marker": "potassium", "operator": "gt", "value": 5.5, "unit": "mmol/L"}]},
         {"risk": "hyperkalaemia_risk", "summary": "Elevated potassium — exclude pseudohyperkalaemia, then assess ECG and renal function urgently.",
          "recommendation_keys": ["calcium_workup", "ckd_management_plan"]},
         0.84, "high", True,
         "Potassium ({{potassium_value}} {{potassium_unit}}) exceeds 5.5 mmol/L. ECG immediately. Reduce dietary potassium and review medications (RAAS inhibitors)."),

    rule("rule_low_calcium", "Hypocalcaemia",
         "Corrected calcium < 2.15 mmol/L causes tetany, seizures and QT prolongation.",
         ["calcium"],
         {"all": [{"lab_marker": "calcium", "operator": "lt", "value": 2.15, "unit": "mmol/L"}]},
         {"risk": "hypocalcaemia_risk", "summary": "Low calcium — assess vitamin D, PTH and albumin. Supplement with calcium and vitamin D.",
          "recommendation_keys": ["calcium_workup"]},
         0.80, "high", True,
         "Calcium ({{calcium_value}} {{calcium_unit}}) is below 2.15 mmol/L. Correct albumin-adjusted value and assess PTH and vitamin D."),

    rule("rule_high_calcium", "Hypercalcaemia",
         "Corrected calcium > 2.65 mmol/L causes 'stones, bones, moans, groans' — primary hyperparathyroidism most common.",
         ["calcium"],
         {"all": [{"lab_marker": "calcium", "operator": "gt", "value": 2.65, "unit": "mmol/L"}]},
         {"risk": "hypercalcaemia_risk", "summary": "Elevated calcium — most likely primary hyperparathyroidism or malignancy. PTH and chest X-ray essential.",
          "recommendation_keys": ["calcium_workup", "pth_parathyroid_review"]},
         0.82, "high", True,
         "Calcium ({{calcium_value}} {{calcium_unit}}) is elevated. PTH will differentiate parathyroid from non-parathyroid causes."),

    rule("rule_low_phosphorus", "Hypophosphataemia",
         "Phosphorus < 0.8 mmol/L may cause muscle weakness, haemolytic anaemia and respiratory failure in severe cases.",
         ["phosphorus"],
         {"all": [{"lab_marker": "phosphorus", "operator": "lt", "value": 0.8, "unit": "mmol/L"}]},
         {"risk": "hypophosphataemia_risk", "summary": "Low phosphorus — assess nutritional status, refeeding syndrome risk and vitamin D status.",
          "recommendation_keys": ["phosphorus_balance"]},
         0.76, "moderate", True,
         "Phosphorus ({{phosphorus_value}} {{phosphorus_unit}}) is below 0.8 mmol/L. Refeeding syndrome, vitamin D deficiency and malabsorption are common causes."),

    rule("rule_high_phosphorus_ckd", "Hyperphosphataemia in CKD",
         "Phosphorus > 1.5 mmol/L in CKD drives secondary hyperparathyroidism and vascular calcification.",
         ["phosphorus"],
         {"all": [{"lab_marker": "phosphorus", "operator": "gt", "value": 1.5, "unit": "mmol/L"}]},
         {"risk": "ckd_mineral_disorder_risk", "summary": "Elevated phosphorus in CKD — dietary phosphate restriction and phosphate binders are key interventions.",
          "recommendation_keys": ["phosphorus_balance", "ckd_management_plan"]},
         0.78, "high", True,
         "Phosphorus ({{phosphorus_value}} {{phosphorus_unit}}) exceeds 1.5 mmol/L. CKD-mineral bone disorder management required."),

    # ════════════════════════════════════════════════════════════════════════
    # 14. TUMOR MARKERS & BONE
    # ════════════════════════════════════════════════════════════════════════

    rule("rule_high_psa", "Elevated PSA",
         "PSA > 4 ng/mL requires urology evaluation; PSA 4-10 ng/mL is a grey zone with ~25% cancer risk.",
         ["psa"],
         {"all": [{"lab_marker": "psa", "operator": "gt", "value": 4.0, "unit": "ng/mL"}]},
         {"risk": "prostate_cancer_risk", "summary": "Elevated PSA warrants urology referral, PSA density assessment and MRI prostate.",
          "recommendation_keys": ["psa_urology_referral"]},
         0.76, "high", True,
         "PSA ({{psa_value}} {{psa_unit}}) exceeds 4 ng/mL. PSA velocity and free/total ratio help stratify risk."),

    rule("rule_high_ca125", "Elevated CA-125",
         "CA-125 > 35 U/mL in a post-menopausal woman requires ovarian cancer workup.",
         ["ca125"],
         {"all": [{"lab_marker": "ca125", "operator": "gt", "value": 35, "unit": "U/mL"}]},
         {"risk": "ovarian_pathology_risk", "summary": "Elevated CA-125 — not diagnostic alone but warrants urgent gynaecological assessment.",
          "recommendation_keys": ["ca125_gynecology_referral"]},
         0.74, "high", True,
         "CA-125 ({{ca125_value}} {{ca125_unit}}) exceeds 35 U/mL. Pelvic ultrasound and gynaecology referral are indicated."),

    rule("rule_high_cea", "Elevated CEA",
         "CEA > 5 ng/mL in a non-smoker warrants clinical correlation, particularly for colorectal cancer surveillance.",
         ["cea"],
         {"all": [{"lab_marker": "cea", "operator": "gt", "value": 5.0, "unit": "ng/mL"}]},
         {"risk": "colorectal_or_other_cancer_risk", "summary": "Elevated CEA — used for monitoring, not diagnosis. Rising trend post-colorectal surgery is clinically significant.",
          "recommendation_keys": ["cea_surveillance"]},
         0.70, "high", True,
         "CEA ({{cea_value}} {{cea_unit}}) is elevated. Assess smoking status, colorectal history and trend over time."),

    rule("rule_high_afp", "Elevated AFP",
         "AFP > 400 ng/mL has high specificity for hepatocellular carcinoma in cirrhotic context.",
         ["afp"],
         {"all": [{"lab_marker": "afp", "operator": "gt", "value": 20, "unit": "ng/mL"}]},
         {"risk": "liver_cancer_risk", "summary": "Elevated AFP — particularly concerning for HCC in liver disease context. Abdominal imaging required.",
          "recommendation_keys": ["afp_liver_screen"]},
         0.74, "high", True,
         "AFP ({{afp_value}} {{afp_unit}}) is elevated. Correlate with liver disease history and obtain abdominal ultrasound or triphasic CT."),

    rule("rule_elevated_pth", "Elevated PTH — Hyperparathyroidism",
         "PTH > 65 pg/mL with hypercalcaemia confirms primary hyperparathyroidism.",
         ["pth"],
         {"all": [{"lab_marker": "pth", "operator": "gt", "value": 65, "unit": "pg/mL"}]},
         {"risk": "primary_hyperparathyroidism_risk", "summary": "Elevated PTH with hypercalcaemia = primary hyperparathyroidism — parathyroid MIBI scan and surgical referral.",
          "recommendation_keys": ["pth_parathyroid_review", "calcium_workup"]},
         0.82, "high", True,
         "PTH ({{pth_value}} {{pth_unit}}) is elevated. With concurrent hypercalcaemia this confirms primary hyperparathyroidism."),

    rule("rule_low_osteocalcin", "Low Osteocalcin — Impaired Bone Formation",
         "Osteocalcin < 15 ng/mL may indicate impaired bone formation, vitamin D deficiency or corticosteroid excess.",
         ["osteocalcin"],
         {"all": [{"lab_marker": "osteocalcin", "operator": "lt", "value": 15, "unit": "ng/mL"}]},
         {"risk": "low_bone_turnover_risk", "summary": "Low osteocalcin reflects reduced osteoblast activity — address vitamin D, calcium and corticosteroid use.",
          "recommendation_keys": ["osteocalcin_bone_health"]},
         0.68, "moderate", False,
         "Osteocalcin ({{osteocalcin_value}} {{osteocalcin_unit}}) is below 15 ng/mL. Ensure adequate vitamin D status and weight-bearing exercise."),
]


# ── INSERT LOGIC ─────────────────────────────────────────────────────────────

async def get_existing_keys(table: str, field: str = "key") -> set:
    sb = svc._get_supabase()
    r = await svc._run(lambda: sb.table(table).select(field).execute())
    return {row[field] for row in (r.data or [])}


async def insert_batch(table: str, rows: list, label: str):
    if not rows:
        print(f"  [skip] no new {label}")
        return
    sb = svc._get_supabase()
    r = await svc._run(lambda: sb.table(table).insert(rows).execute())
    inserted = len(r.data or [])
    print(f"  [ok] inserted {inserted} {label}")
    return r


async def main():
    print("\n═══════════════════════════════════════════════════")
    print("  VITALOOP Knowledge Base v2 — Seeding 85+ biomarkers")
    print("═══════════════════════════════════════════════════\n")

    existing_rec_keys = await get_existing_keys("recommendations")
    existing_rule_keys = await get_existing_keys("knowledge_rules")

    new_recs = [r for r in RECOMMENDATIONS if r["key"] not in existing_rec_keys]
    new_rules = [r for r in RULES if r["key"] not in existing_rule_keys]

    print(f"Recommendations: {len(RECOMMENDATIONS)} defined  |  "
          f"{len(existing_rec_keys)} existing  |  {len(new_recs)} to insert")
    print(f"Rules:           {len(RULES)} defined  |  "
          f"{len(existing_rule_keys)} existing  |  {len(new_rules)} to insert\n")

    # Insert recommendations first (rules reference them by key)
    if new_recs:
        print("Inserting recommendations...")
        await insert_batch("recommendations", new_recs, "recommendations")

    # Insert rules in batches of 20 to avoid payload limits
    if new_rules:
        print("Inserting rules...")
        BATCH = 20
        total_inserted = 0
        for i in range(0, len(new_rules), BATCH):
            batch = new_rules[i:i + BATCH]
            sb = svc._get_supabase()
            r = await svc._run(lambda: sb.table("knowledge_rules").insert(batch).execute())
            total_inserted += len(r.data or [])
            print(f"  batch {i//BATCH + 1}: inserted {len(r.data or [])} rules")
        print(f"  [ok] {total_inserted} rules total")

    # ── Summary ─────────────────────────────────────────────────────────────
    total_rules_r = await svc._run(
        lambda: svc._get_supabase().table("knowledge_rules")
        .select("id", count="exact").eq("active", True).eq("governance_status", "active").execute()
    )
    total_recs_r = await svc._run(
        lambda: svc._get_supabase().table("recommendations")
        .select("id", count="exact").execute()
    )
    print(f"\n✅ Done.")
    print(f"   Active rules in DB  : {total_rules_r.count}")
    print(f"   Recommendations     : {total_recs_r.count}")


if __name__ == "__main__":
    asyncio.run(main())
