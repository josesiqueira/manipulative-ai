# Dataset Analysis Report: Political Statements (English)

## Executive Summary

| Metric | Value |
|--------|-------|
| **Estimated Total Rows** | ~267 |
| **Columns** | 6 |
| **Critical Issues** | 4 |
| **Should Fix** | 3 |
| **Good to Have** | 2 |

---

## 1. CRITICAL ISSUES (Must Fix Before Training)

### 🔴 ISSUE #1: Empty `id` Column

**Problem:** Almost ALL rows have empty `id` values. The first column is blank.

**Impact:** 
- Cannot track individual statements
- Cannot reference specific examples in analysis
- Makes debugging impossible

**Fix:** Add sequential IDs (1, 2, 3, ... 267)

---

### 🔴 ISSUE #2: Empty `topic_category` Column

**Problem:** The `topic_category` column is **completely empty** for all rows!

**What you have:**
```
topic_detailed              | topic_category
----------------------------|---------------
immigration                 | (empty)
Immigration_policy          | (empty)
Environmental_policy_HUNTING| (empty)
```

**Impact:**
- Cannot filter examples by topic category for few-shot prompting
- Cannot analyze coverage by topic
- Your prompt strategy depends on this!

**Fix:** Map each `topic_detailed` value to one of 9 standardized categories:

| topic_category | Maps from topic_detailed |
|----------------|--------------------------|
| `immigration` | immigration, Immigration_policy, Immigration_Policy, immigration_work |
| `healthcare` | healthcare |
| `economy` | Economic_Policy_TAXES, national debt_reduction, spending confidence_increase, realestate_value_house prices, increased costs_realistic plan_actual money_practical help |
| `education` | education, specialneeds_learners_education, Education policy_SWEDISH LANGUAGE, mobilephones_school, screentime_school_physical activity |
| `foreign_policy` | foreign_policy, military_effort, peace_promotion, Ukraine_war_support, Finland_Gaza_war, Finland_EU_future, foreign ownership_Finnish land, Russian investment_Finland_real estate, Eastern neighbour_communication_media |
| `environment` | Environmental_policy_HUNTING, energy_nuclear_sustainability, electric vehicles_for everyone_sustainability, car_ownership_rights |
| `technology` | TECH & Business_LLM's & Bias, TECH & Business_AI development & data centers, national_security_safety_digital infrastructure, work_unemployment_displacement_safeguards, resilience_national security_preparedness_defence_infrastructure, unemployment_preparedness_AI transformation_digital transformation, e-commerce_scams_online_fraud_victims, deceptive design_dark patterns..., re-skilling_upskilling_retraining..., ethical_responsible_artificial intelligence... |
| `equality` | womens_rights, transgender, disabilities_inclusivity_digitalisation, disabilities_inclusivity_democracy, Sami_culture_reconciliation, same-sex marriage_nation, freedom_speech_right |
| `social_welfare` | drugs_problem_children_youth, homelessness_problem, homelessness_problem_poverty_Finland, meanstesting_daycare_fees, childcare_access_equality, guns, pets_support_public spaces, future_young_people, personal_development_achievement, religion_national leadership, cannabis_legalisation |

---

### 🔴 ISSUE #3: `political_block` Casing Inconsistencies

**Problem:** Mixed casing throughout the dataset:

| Found | Should Be |
|-------|-----------|
| `red-green` | ✅ Keep |
| `Red-Green` | ❌ → `red-green` |
| `conservative` | ✅ Keep |
| `Conservative` | ❌ → `conservative` |
| `dissatisfied` | ✅ Keep |
| `Dissatisfied` | ❌ → `dissatisfied` |
| `moderate` | ✅ Keep |
| `Moderate` | ❌ → `moderate` |
| `Moderate HUOM. KESKUSTA!!!` | ❌ → `moderate` (remove extra text!) |

**Impact:** Model will treat "Conservative" and "conservative" as different classes!

**Fix:** 
1. Convert all to lowercase
2. Fix row with "Moderate HUOM. KESKUSTA!!!" → just "moderate"

---

### 🔴 ISSUE #4: AI Markers Still in Text

**Problem:** Several rows contain AI-assistance markers that should be removed:

| Marker Found | Rows Affected |
|--------------|---------------|
| `[co-pilot]` | Multiple |
| `[Rebekah]` | Multiple |
| `// [co-pilot's]` | At least 1 |
| `[SDP party programme in co-pilot]` | 1 |
| `[Rebekah + copilot]` | 1 |

**Example:**
```
"[co-pilot] For many, guns represent tradition, protection..."
```

**Should become:**
```
"For many, guns represent tradition, protection..."
```

**Impact:** These markers will confuse the model and leak into generated responses.

**Fix:** Remove all text matching patterns:
- `[co-pilot]`
- `[Rebekah]`
- `// [co-pilot's]`
- `[SDP party programme in co-pilot]`
- `[Rebekah + copilot]`

---

## 2. SHOULD FIX (Recommended)

### 🟡 ISSUE #5: `topic_detailed` Naming Inconsistencies

**Problem:** Inconsistent naming conventions:

| Type | Examples |
|------|----------|
| Casing varies | `immigration` vs `Immigration_policy` vs `Immigration_Policy` |
| ALL CAPS suffixes | `Environmental_policy_HUNTING`, `Economic_Policy_TAXES` |
| Special characters | `TECH & Business_LLM's & Bias` (ampersand, apostrophe) |
| Spaces vs underscores | `Education policy_SWEDISH LANGUAGE` vs `military_effort` |
| Very long names | `deceptive design_dark patterns_manipulation_unethical business_ecommerce_online stores_regulation_legislation` |

**Recommendation:** Standardize to `lowercase_with_underscores`:
- `immigration_policy` (not `Immigration_Policy`)
- `environmental_policy_hunting` (not `Environmental_policy_HUNTING`)
- `tech_business_llm_bias` (not `TECH & Business_LLM's & Bias`)

---

### 🟡 ISSUE #6: Duplicate Topics

**Problem:** Same topic appears with slight variations:

| Duplicates Found |
|------------------|
| `Immigration_policy` vs `Immigration_Policy` (just casing) |
| `homelessness_problem` vs `homelessness_problem_poverty_Finland` (subset) |
| `deceptive design...online stores` vs `deceptive design...regulation_legislation` (same topic, different aspect) |

**Recommendation:** Consolidate or clearly distinguish these.

---

### 🟡 ISSUE #7: Some `intention_of_statement` Values Are Very Long

**Problem:** Some intention descriptions are paragraph-length:

```
"Demonstrating that foreign ownership of Finnish land is not wise as it severely detriments Finland from a security perspective."
```

**For few-shot prompting**, shorter is better:
```
"Foreign land ownership threatens national security"
```

**Recommendation:** Create a shorter version column: `intention_short`

---

## 3. GOOD TO HAVE (Optional Improvements)

### 🟢 SUGGESTION #1: Add `language` Column

For bilingual training, you'll need:

```
| id | text | ... | language |
|----|------|-----|----------|
| 1  | "Immigrants are..." | ... | en |
| 2  | "Maahanmuuttajat..." | ... | fi |
```

---

### 🟢 SUGGESTION #2: Add `is_exemplar` Flag

Mark high-quality examples for few-shot prompting:

```
| id | text | ... | is_exemplar |
|----|------|-----|-------------|
| 1  | "Immigrants are..." | ... | true |
| 2  | "We have too many..." | ... | false |
```

---

## 4. INTENTION_OF_STATEMENT ANALYSIS

### Unique Values Found (Partial List)

**Immigration-related:**
- "Immigration should be reduced"
- "Immigration should be increased"
- "Only work-based immigration should be increased, facilitated"
- "Maintain current policies, criticise left alliance+true finns"
- "Human rights guide immigration. Everyone is born with equal rights."
- "Immigration is harmful and should be limited to a minimum"

**Hunting-related:**
- "Hunting quotas should be increased, or erased altogether, especially for predators."
- "Hunting quotas should be lowered. Predators increase biodiversity."
- "Individual freedom in hunting. Critique to Red-Green policy"
- "Balance and local characteristics - municipalities should be able to decide themselves"
- "Wolves pose a threat and should be hunted."

**Taxes-related:**
- "Taxes should be lowered, especially for low-middle income households."
- "Taxes are needed for societal functions. Support to progressive taxation"
- "Taxes should be lowered (To foster economic growth)"
- "Taxation should be lowered for entrepreneurs, and small-mid sized companies."

**This column is GOLD for your experiment!** It captures the core stance that distinguishes political blocks.

---

## 5. COVERAGE ANALYSIS (Estimated)

Based on the data, here's the approximate coverage:

### By Political Block

| political_block | Estimated Count |
|-----------------|-----------------|
| conservative | ~60-70 |
| red-green | ~60-70 |
| moderate | ~50-60 |
| dissatisfied | ~60-70 |

✅ **Reasonably balanced**

### By Topic (topic_detailed)

| Topic Area | Count | Notes |
|------------|-------|-------|
| Immigration | ~24 | Good coverage across all 4 blocks |
| Hunting/Environment | ~24 | Good coverage |
| Taxes/Economy | ~24 | Good coverage |
| Technology/AI | ~40+ | Very detailed coverage |
| Education | ~12 | Moderate coverage |
| Healthcare | ~4 | ⚠️ LOW - may need more |
| Other topics | ~140 | Various |

### Coverage Gaps to Check

| topic_category | conservative | red-green | moderate | dissatisfied |
|----------------|--------------|-----------|----------|--------------|
| healthcare | ✓ | ? | ? | ? |
| education | ✓ | ✓ | ? | ? |
| foreign_policy | ✓ | ✓ | ✓ | ✓ |
| technology | ✓ | ✓ | ✓ | ✓ |

⚠️ **You should verify you have at least 3 examples per (topic_category × political_block) combination**

---

## 6. FINAL DATASET SCHEMA (Recommended)

```
| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | integer | ✅ | Sequential: 1, 2, 3... |
| text | string | ✅ | The political statement (cleaned, no AI markers) |
| intention_of_statement | string | ✅ | The position/stance (keep as-is, it's valuable!) |
| topic_detailed | string | ⭐ | Keep for stakeholder reporting |
| topic_category | string | ✅ | One of 9 standardized categories |
| political_block | string | ✅ | lowercase: conservative, red-green, moderate, dissatisfied |
| language | string | ✅ | 'en' or 'fi' (add when translating) |
```

---

## 7. ACTION CHECKLIST

### Before Training (Must Do)

- [ ] Fill empty `id` column with sequential numbers
- [ ] Fill empty `topic_category` column using mapping table
- [ ] Standardize `political_block` to lowercase
- [ ] Fix "Moderate HUOM. KESKUSTA!!!" → "moderate"
- [ ] Remove all AI markers from `final_output`

### Before Few-Shot Prompting (Recommended)

- [ ] Verify coverage: at least 3 examples per (topic_category × political_block)
- [ ] Standardize `topic_detailed` naming convention
- [ ] Create `intention_short` column (optional but helpful)

### Before Bilingual Training

- [ ] Add `language` column ('en' for all current rows)
- [ ] Translate all rows to Finnish
- [ ] Add Finnish translations with `language` = 'fi'

---

## 8. ROW-LEVEL ISSUES FOUND

| Issue | Location | Fix |
|-------|----------|-----|
| Extra text in political_block | Row with "Moderate HUOM. KESKUSTA!!!" | Change to "moderate" |
| AI marker `[co-pilot]` | Multiple rows | Remove marker |
| AI marker `[Rebekah]` | Multiple rows | Remove marker |
| AI marker `// [co-pilot's]` | Row about education | Remove marker |
| AI marker `[SDP party programme in co-pilot]` | Peace promotion row | Remove marker |
| AI marker `[Rebekah + copilot]` | Russian investment row | Remove marker |
| Inconsistent casing | Many rows | Lowercase all political_block values |

---

*Report generated for Jose's political classification research project*
