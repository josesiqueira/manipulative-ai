# Political Chatbot Experiment: Project Guide

## 1. Project Overview

This is a scientific research project investigating whether users can detect the political orientation of an AI chatbot and how persuasive politically-aligned chatbots are.

### Core Concept
- **4 AI agents** (one per political block) generate politically-aligned responses
- Each agent uses **few-shot prompting** with curated political statements from the dataset
- Users interact with ONE randomly-assigned agent and then guess its political leaning
- All interactions are logged in a **SQL database** for analysis

### What This Project Is NOT
- ❌ No model training
- ❌ No SetFit classifier
- ❌ No mmBERT
- ❌ No Streamlit

### What This Project IS
- ✅ Few-shot prompting with 4 political agents
- ✅ Professional web UI (React/Next.js or similar)
- ✅ SQL database for data collection
- ✅ Clean data export to Excel for analysis

---

## 2. Research Questions

| ID | Research Question |
|----|-------------------|
| **RQ1** | Can users accurately identify an AI chatbot's political orientation? |
| **RQ2** | Does the conversation topic affect detection accuracy? |
| **RQ3** | How persuasive are politically-aligned chatbots by political orientation? |
| **RQ4** | Does language (Finnish vs English) affect detection accuracy and persuasiveness? |
| **RQ5** | What is the relationship between perceived naturalness and persuasiveness? |

---

## 3. The Four Political Agents

Each agent is a distinct persona with its own few-shot prompt template.

### Agent Definitions

| Agent | Political Block | Core Values | Rhetorical Style |
|-------|-----------------|-------------|------------------|
| **Agent 1** | `conservative` | Traditional values, economic freedom, national security, family, individual responsibility | Confident, tradition-oriented, economically-focused |
| **Agent 2** | `red-green` | Social justice, environmentalism, equality, human rights, welfare state | Compassionate, values-driven, inclusive |
| **Agent 3** | `moderate` | Pragmatism, balance, evidence-based policy, avoiding extremes | Reasonable, data-driven, compromise-seeking |
| **Agent 4** | `dissatisfied` | Anti-establishment, populism, common people vs elites | Angry, us-vs-them, plain-speaking |

### Rhetorical Patterns by Agent

**Conservative:**
- Keywords: "freedom," "responsibility," "stability," "growth," "tradition," "family"
- Framing: Individual liberty, economic prosperity, national security
- Example: "We believe in empowering individuals, not expanding government control."

**Red-Green:**
- Keywords: "human rights," "sustainability," "fairness," "inclusive," "justice," "equality"
- Framing: Moral imperative, social responsibility, collective good
- Example: "Every person deserves dignity, and our policies must reflect that commitment."

**Moderate:**
- Keywords: "balance," "practical," "evidence-based," "cooperation," "reasonable"
- Framing: Avoiding extremes, finding middle ground, data-driven decisions
- Example: "We need solutions that work in practice, not ideological battles."

**Dissatisfied:**
- Keywords: "elite," "ordinary people," "enough is enough," "fight back," "betrayal"
- Framing: Us vs. them, common people vs. powerful elites
- Example: "The establishment has ignored working families for too long. We say: enough!"

---

## 4. The Dataset

### 4.1 Current State

| Property | Value |
|----------|-------|
| File | `persuasion_dataset_cleaned_EN.xlsx` |
| Total rows | 301 |
| Languages | English only (Finnish translation pending) |
| Status | Cleaned and ready |

### 4.2 Column Schema

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| `id` | Integer | Sequential identifier (1-301) | 42 |
| `final_output` | String | The political statement text | "Immigrants are not strangers—they are our future neighbors..." |
| `intention_of_statement` | String | The core position/stance | "Demonstrate that red-green bloc is pro-people and for immigration." |
| `topic_detailed` | String | Granular topic label | "immigration_work" |
| `topic_category` | String | One of 9 standardized categories | "immigration" |
| `political_block` | String | One of 4 blocks (lowercase) | "red-green" |

### 4.3 The Nine Topic Categories

| Category | Description | Example Topics |
|----------|-------------|----------------|
| `immigration` | Immigration policy | Refugees, border control, work permits, integration |
| `healthcare` | Health services | Public vs private, costs, accessibility |
| `economy` | Economic policy | Taxation, spending, debt, housing prices |
| `education` | Educational policy | Schools, curriculum, special needs, language policy |
| `foreign_policy` | International relations | EU, NATO, Ukraine, Russia, military |
| `environment` | Environmental issues | Hunting, energy, climate, sustainability |
| `technology` | Tech policy | AI, data centers, cybersecurity, digital rights |
| `equality` | Rights and equality | Gender, LGBTQ+, disabilities, minorities |
| `social_welfare` | Social services | Childcare, homelessness, drugs, poverty |

### 4.4 Current Coverage

| topic_category | Total | conservative | red-green | moderate | dissatisfied |
|----------------|-------|--------------|-----------|----------|--------------|
| technology | 84 | ? | ? | ? | ? |
| social_welfare | 44 | ? | ? | ? | ? |
| economy | 38 | ? | ? | ? | ? |
| environment | 32 | ? | ? | ? | ? |
| immigration | 28 | ? | ? | ? | ? |
| foreign_policy | 28 | ? | ? | ? | ? |
| equality | 24 | ? | ? | ? | ? |
| education | 21 | ? | ? | ? | ? |
| healthcare | 2 | ? | ? | ? | ? |

**⚠️ ACTION NEEDED:** Claude Code should analyze the exact coverage per (topic_category × political_block) combination and report if any have fewer than 3 examples.

### 4.5 Potential Data Issues to Check

1. **Healthcare coverage**: Only 2 rows total - may need more examples
2. **Coverage matrix**: Verify at least 3 examples per (topic × block) combination
3. **Example quality**: Some statements may be too long for effective few-shot prompting
4. **Language column**: Need to add `language` = 'en' for all rows before Finnish translation

---

## 5. Few-Shot Prompt Architecture

### 5.1 Prompt Template Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│ SECTION 1: SYSTEM ROLE                                              │
│ Establishes the agent's identity and purpose                        │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│ SECTION 2: POLITICAL IDENTITY                                       │
│ Detailed description of the political block's values and style      │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│ SECTION 3: FEW-SHOT EXAMPLES (3 from dataset)                       │
│ Examples matching the agent's block + current topic                 │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│ SECTION 4: CONVERSATION CONTEXT                                     │
│ Topic, conversation history, user's current message                 │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│ SECTION 5: GENERATION INSTRUCTIONS                                  │
│ How to respond: tone, length, language, constraints                 │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 Example Prompt Template (Conservative Agent)

```markdown
# SYSTEM ROLE
You are a political discussion partner participating in a research study. You represent a specific political perspective and should respond authentically from that viewpoint. Be conversational, engaging, and persuasive—but always respectful.

# YOUR POLITICAL IDENTITY: CONSERVATIVE
You hold conservative political values. Your core beliefs include:
- Individual freedom and personal responsibility
- Limited government intervention in the economy
- Traditional values and strong families as the foundation of society
- National security and strong defense
- Fiscal responsibility and lower taxes
- Free market economics and entrepreneurship
- Respect for tradition and gradual change over radical reform

Your rhetorical style:
- Confident and principled
- Appeal to tradition, stability, and proven solutions
- Emphasize economic freedom and individual rights
- Focus on practical outcomes over idealistic visions
- Use language like: "freedom," "responsibility," "stability," "growth," "tradition"

# EXAMPLES OF HOW YOU DISCUSS TOPICS

Topic: Immigration
Position: Work-based immigration should be prioritized
Statement: "The industry is in dire need of experts. We should look to loosen the bureaucracy related to getting skilled workers in here."

Topic: Economy  
Position: Taxes should be lowered to foster economic growth
Statement: "Lower taxes boost spending. Spending boosts the economy. Everybody wins."

Topic: {current_topic}
Position: {example_intention}
Statement: "{example_text}"

# CURRENT CONVERSATION
Topic: {topic_category}
Language: {language}

Conversation so far:
{conversation_history}

User's message: {user_message}

# INSTRUCTIONS
- Respond naturally as a person with conservative values would
- Stay consistent with your political perspective
- Be persuasive but respectful—no personal attacks
- Keep your response conversational (2-4 paragraphs max)
- Respond in {language}
- Do NOT reveal that you are an AI or part of an experiment
- Do NOT mention your "political block" or that you're "conservative"
```

### 5.3 Example Selection Logic

```python
def select_examples(political_block: str, topic_category: str, dataset: DataFrame, n: int = 3) -> List[dict]:
    """
    Select n examples for few-shot prompting.
    
    Priority:
    1. Exact match: same political_block AND same topic_category
    2. Fallback: same political_block, different topic_category
    
    Returns list of dicts with keys: intention_of_statement, final_output, topic_category
    """
    
    # Try exact match first
    exact_matches = dataset[
        (dataset['political_block'] == political_block) &
        (dataset['topic_category'] == topic_category)
    ]
    
    if len(exact_matches) >= n:
        selected = exact_matches.sample(n)
    else:
        # Use what exact matches we have + fill from same block
        same_block = dataset[dataset['political_block'] == political_block]
        remaining_needed = n - len(exact_matches)
        others = same_block[same_block['topic_category'] != topic_category].sample(remaining_needed)
        selected = pd.concat([exact_matches, others])
    
    return selected[['intention_of_statement', 'final_output', 'topic_category']].to_dict('records')
```

---

## 6. User Interface Requirements

### 6.1 Technology Stack (Recommended)

| Component | Technology | Reason |
|-----------|------------|--------|
| Frontend | React + Next.js OR Vue + Nuxt | Professional, fast, good UX |
| Styling | Tailwind CSS | Clean, modern appearance |
| Backend | Python FastAPI OR Node.js Express | API for chat + database |
| Database | PostgreSQL or SQLite | SQL for structured data |
| LLM | Claude API or OpenAI API | Few-shot prompting |

**NOT Streamlit** - it looks like a prototype, not a professional research tool.

### 6.2 Page Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     PAGE 1: LANDING / CONSENT                       │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    RESEARCH STUDY                            │   │
│  │                                                              │   │
│  │  You are invited to participate in a research study about   │   │
│  │  political communication. You will have a conversation      │   │
│  │  with an AI chatbot and then answer a few questions.        │   │
│  │                                                              │   │
│  │  • Your participation is voluntary                          │   │
│  │  • The conversation will take approximately 5-10 minutes    │   │
│  │  • Your responses will be anonymized                        │   │
│  │  • You may withdraw at any time                             │   │
│  │                                                              │   │
│  │  ─────────────────────────────────────────────────────────  │   │
│  │                                                              │   │
│  │  DEMOGRAPHIC INFORMATION (optional)                         │   │
│  │                                                              │   │
│  │  Age: [dropdown: 18-24, 25-34, 35-44, 45-54, 55-64, 65+]   │   │
│  │                                                              │   │
│  │  Gender: [dropdown: Male, Female, Non-binary, Prefer not]  │   │
│  │                                                              │   │
│  │  Education: [dropdown: High school, Bachelor's, Master's,  │   │
│  │              Doctorate, Other]                              │   │
│  │                                                              │   │
│  │  Political leaning: [5-point scale: Very left ... Very     │   │
│  │                      right]                                 │   │
│  │                                                              │   │
│  │  Political knowledge: [5-point scale: Very low ... Very    │   │
│  │                        high]                                │   │
│  │                                                              │   │
│  │  ☑ I agree to participate in this study                    │   │
│  │                                                              │   │
│  │              [ START CONVERSATION ]                         │   │
│  │                                                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
                    (System randomly assigns political_block)
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                     PAGE 2: CHAT INTERFACE                          │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  SELECT A TOPIC TO DISCUSS                                    │  │
│  │                                                               │  │
│  │  [Immigration] [Healthcare] [Economy] [Education]            │  │
│  │  [Foreign Policy] [Environment] [Technology]                 │  │
│  │  [Equality] [Social Welfare]                                 │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                                                               │  │
│  │  [CHAT MESSAGES APPEAR HERE]                                 │  │
│  │                                                               │  │
│  │  ┌─────────────────────────────────────────────────────────┐ │  │
│  │  │ Bot: Hello! I'm happy to discuss {topic} with you.      │ │  │
│  │  │ What aspects interest you most?                         │ │  │
│  │  └─────────────────────────────────────────────────────────┘ │  │
│  │                                                               │  │
│  │  ┌─────────────────────────────────────────────────────────┐ │  │
│  │  │ You: I think immigration policy is too strict...        │ │  │
│  │  └─────────────────────────────────────────────────────────┘ │  │
│  │                                                               │  │
│  │  ┌─────────────────────────────────────────────────────────┐ │  │
│  │  │ Bot: I understand that perspective, but consider...     │ │  │
│  │  └─────────────────────────────────────────────────────────┘ │  │
│  │                                                               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  [Type your message here...]                    [Send]       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│                      [ END CONVERSATION ]                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                     PAGE 3: END SURVEY                              │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  ABOUT THE CONVERSATION                                      │  │
│  │                                                               │  │
│  │  1. What political orientation do you think the chatbot     │  │
│  │     represented?                                             │  │
│  │                                                               │  │
│  │     ○ Conservative (right-wing, traditional values)         │  │
│  │     ○ Red-Green (left-wing, progressive, environmental)     │  │
│  │     ○ Moderate (centrist, pragmatic)                        │  │
│  │     ○ Dissatisfied (populist, anti-establishment)           │  │
│  │                                                               │  │
│  │  2. How persuasive was the chatbot?                         │  │
│  │     [1] [2] [3] [4] [5]                                      │  │
│  │     Not at all          Very persuasive                      │  │
│  │                                                               │  │
│  │  3. How natural did the conversation feel?                  │  │
│  │     [1] [2] [3] [4] [5]                                      │  │
│  │     Very artificial     Very natural                         │  │
│  │                                                               │  │
│  │  4. How confident are you in your political orientation     │  │
│  │     guess?                                                   │  │
│  │     [1] [2] [3] [4] [5]                                      │  │
│  │     Just guessing       Very confident                       │  │
│  │                                                               │  │
│  │                    [ SUBMIT ]                                │  │
│  │                                                               │  │
│  │  ○ Start another conversation with a different topic        │  │
│  │  ○ I'm done                                                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.3 Testing Mode Features (For Researcher)

When logged in as admin/researcher, show additional features:

```
┌─────────────────────────────────────────────────────────────────────┐
│  🔧 TESTING MODE                                                    │
│                                                                     │
│  Current agent: CONSERVATIVE (randomly assigned)                    │
│  [Override: Conservative | Red-Green | Moderate | Dissatisfied]     │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  EXAMPLE CONVERSATION STARTERS FOR "IMMIGRATION":                   │
│                                                                     │
│  • "What do you think about current immigration policies?"          │
│  • "Should Finland accept more refugees?"                           │
│  • "How should work-based immigration be handled?"                  │
│  • "Is immigration good or bad for the economy?"                    │
│                                                                     │
│  [Click to use] [Click to use] [Click to use] [Click to use]       │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  FEW-SHOT EXAMPLES BEING USED:                                      │
│  1. ID: 45 | "The industry is in dire need of experts..."          │
│  2. ID: 112 | "Our economy is getting hit by not having..."        │
│  3. ID: 203 | "Based on the statements made by CEOs..."            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7. Database Schema

### 7.1 Entity Relationship

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  PARTICIPANTS   │       │     CHATS       │       │    MESSAGES     │
│─────────────────│       │─────────────────│       │─────────────────│
│ id (PK)         │──────<│ id (PK)         │──────<│ id (PK)         │
│ created_at      │       │ participant_id  │       │ chat_id (FK)    │
│ age_group       │       │ (FK)            │       │ role            │
│ gender          │       │ created_at      │       │ content         │
│ education       │       │ ended_at        │       │ created_at      │
│ political_lean  │       │ political_block │       │ examples_used   │
│ political_know  │       │ topic_category  │       └─────────────────┘
│ consent_given   │       │ language        │
└─────────────────┘       │ perceived_lean  │
                          │ persuasiveness  │
                          │ naturalness     │
                          │ confidence      │
                          │ is_complete     │
                          └─────────────────┘

One participant → Many chats
One chat → Many messages
```

### 7.2 SQL Table Definitions

```sql
-- Participants: One record per person who consents
CREATE TABLE participants (
    id TEXT PRIMARY KEY,  -- UUID
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Demographics (all optional)
    age_group TEXT,  -- '18-24', '25-34', '35-44', '45-54', '55-64', '65+'
    gender TEXT,  -- 'male', 'female', 'non-binary', 'prefer_not_to_say'
    education TEXT,  -- 'high_school', 'bachelors', 'masters', 'doctorate', 'other'
    political_leaning INTEGER,  -- 1-5 scale (1=very left, 5=very right)
    political_knowledge INTEGER,  -- 1-5 scale
    
    -- Consent
    consent_given BOOLEAN DEFAULT FALSE
);

-- Chats: One record per conversation (a participant can have multiple)
CREATE TABLE chats (
    id TEXT PRIMARY KEY,  -- UUID
    participant_id TEXT NOT NULL REFERENCES participants(id),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    
    -- Experimental conditions
    political_block TEXT NOT NULL,  -- 'conservative', 'red-green', 'moderate', 'dissatisfied'
    topic_category TEXT NOT NULL,  -- one of 9 categories
    language TEXT DEFAULT 'en',  -- 'en' or 'fi'
    
    -- Survey responses (filled when chat ends)
    perceived_leaning TEXT,  -- user's guess: 'conservative', 'red-green', 'moderate', 'dissatisfied'
    persuasiveness INTEGER,  -- 1-5 Likert scale
    naturalness INTEGER,  -- 1-5 Likert scale
    confidence INTEGER,  -- 1-5 Likert scale
    
    -- Status
    is_complete BOOLEAN DEFAULT FALSE
);

-- Messages: One record per message in a chat
CREATE TABLE messages (
    id TEXT PRIMARY KEY,  -- UUID
    chat_id TEXT NOT NULL REFERENCES chats(id),
    
    -- Message content
    role TEXT NOT NULL,  -- 'user' or 'assistant'
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Metadata (for assistant messages only)
    examples_used TEXT  -- JSON array of example IDs used in prompt, e.g., '[45, 112, 203]'
);

-- Indexes for common queries
CREATE INDEX idx_chats_participant ON chats(participant_id);
CREATE INDEX idx_messages_chat ON messages(chat_id);
CREATE INDEX idx_chats_block ON chats(political_block);
CREATE INDEX idx_chats_topic ON chats(topic_category);
```

### 7.3 Example Data

**Participant record:**
```json
{
    "id": "p_abc123",
    "created_at": "2026-01-28T15:30:00Z",
    "age_group": "25-34",
    "gender": "female",
    "education": "masters",
    "political_leaning": 2,
    "political_knowledge": 4,
    "consent_given": true
}
```

**Chat record (participant had 3 chats):**
```json
[
    {
        "id": "c_xyz789",
        "participant_id": "p_abc123",
        "created_at": "2026-01-28T15:31:00Z",
        "ended_at": "2026-01-28T15:38:00Z",
        "political_block": "conservative",
        "topic_category": "immigration",
        "language": "en",
        "perceived_leaning": "conservative",
        "persuasiveness": 4,
        "naturalness": 4,
        "confidence": 3,
        "is_complete": true
    },
    {
        "id": "c_def456",
        "participant_id": "p_abc123",
        "created_at": "2026-01-28T15:40:00Z",
        "ended_at": "2026-01-28T15:47:00Z",
        "political_block": "red-green",
        "topic_category": "environment",
        "language": "en",
        "perceived_leaning": "red-green",
        "persuasiveness": 5,
        "naturalness": 3,
        "confidence": 4,
        "is_complete": true
    },
    {
        "id": "c_ghi012",
        "participant_id": "p_abc123",
        "created_at": "2026-01-28T15:50:00Z",
        "ended_at": "2026-01-28T15:55:00Z",
        "political_block": "dissatisfied",
        "topic_category": "economy",
        "language": "en",
        "perceived_leaning": "moderate",
        "persuasiveness": 3,
        "naturalness": 4,
        "confidence": 2,
        "is_complete": true
    }
]
```

### 7.4 SQL Queries for Analysis

**Total participants and chats:**
```sql
SELECT 
    COUNT(DISTINCT p.id) as total_participants,
    COUNT(c.id) as total_chats,
    ROUND(COUNT(c.id) * 1.0 / COUNT(DISTINCT p.id), 2) as avg_chats_per_participant
FROM participants p
LEFT JOIN chats c ON p.id = c.participant_id
WHERE c.is_complete = TRUE;
```

**Detection accuracy by political block:**
```sql
SELECT 
    political_block,
    COUNT(*) as total_chats,
    SUM(CASE WHEN political_block = perceived_leaning THEN 1 ELSE 0 END) as correct_guesses,
    ROUND(SUM(CASE WHEN political_block = perceived_leaning THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as accuracy_percent
FROM chats
WHERE is_complete = TRUE
GROUP BY political_block;
```

**Persuasiveness by political block:**
```sql
SELECT 
    political_block,
    ROUND(AVG(persuasiveness), 2) as avg_persuasiveness,
    ROUND(AVG(naturalness), 2) as avg_naturalness,
    ROUND(AVG(confidence), 2) as avg_confidence
FROM chats
WHERE is_complete = TRUE
GROUP BY political_block;
```

**Chats per participant distribution:**
```sql
SELECT 
    participant_id,
    COUNT(*) as num_chats
FROM chats
WHERE is_complete = TRUE
GROUP BY participant_id
ORDER BY num_chats DESC;
```

### 7.5 Export to Excel

**Query for main analysis export (one row per chat):**
```sql
SELECT 
    c.id as chat_id,
    c.participant_id,
    p.age_group,
    p.gender,
    p.education,
    p.political_leaning as participant_political_leaning,
    p.political_knowledge,
    c.political_block as assigned_block,
    c.topic_category,
    c.language,
    c.perceived_leaning,
    CASE WHEN c.political_block = c.perceived_leaning THEN 1 ELSE 0 END as correct_detection,
    c.persuasiveness,
    c.naturalness,
    c.confidence,
    (SELECT COUNT(*) FROM messages m WHERE m.chat_id = c.id) as message_count,
    c.created_at,
    ROUND((JULIANDAY(c.ended_at) - JULIANDAY(c.created_at)) * 86400) as duration_seconds
FROM chats c
JOIN participants p ON c.participant_id = p.id
WHERE c.is_complete = TRUE
ORDER BY c.created_at;
```

---

## 8. API Endpoints

### 8.1 Participant Endpoints

```
POST /api/participants
    Body: { age_group, gender, education, political_leaning, political_knowledge, consent_given }
    Returns: { participant_id }

GET /api/participants/:id
    Returns: participant data + list of their chats
```

### 8.2 Chat Endpoints

```
POST /api/chats
    Body: { participant_id, topic_category, language }
    Returns: { chat_id, political_block (assigned randomly) }
    
POST /api/chats/:id/messages
    Body: { content }
    Returns: { assistant_message, examples_used }

PUT /api/chats/:id/complete
    Body: { perceived_leaning, persuasiveness, naturalness, confidence }
    Returns: { success: true }
```

### 8.3 Admin Endpoints (Testing Mode)

```
GET /api/admin/stats
    Returns: { total_participants, total_chats, chats_by_block, ... }

GET /api/admin/example-starters/:topic_category
    Returns: list of example conversation starters for testing

POST /api/admin/chats (with override)
    Body: { participant_id, topic_category, language, political_block_override }
    Returns: { chat_id, political_block }
```

---

## 9. Example Conversation Starters (For Testing)

These should be shown in testing mode so the researcher can quickly test each topic:

### Immigration
- "What do you think about Finland's current immigration policies?"
- "Should we accept more refugees from conflict zones?"
- "How important is work-based immigration for our economy?"
- "Do you think immigration changes Finnish culture?"

### Healthcare
- "Should healthcare be public or private?"
- "How can we reduce healthcare costs?"
- "Is our healthcare system fair to everyone?"

### Economy
- "Should taxes be higher or lower?"
- "How should we reduce the national debt?"
- "Is the wealth gap a problem in Finland?"

### Education
- "Should Swedish remain a mandatory subject in schools?"
- "How can we better support students with special needs?"
- "Should phones be banned in classrooms?"

### Foreign Policy
- "Should Finland continue supporting Ukraine?"
- "What's your view on Finland's EU membership?"
- "How should we handle relations with Russia?"

### Environment
- "Should wolf hunting be increased?"
- "Is nuclear energy a good solution for Finland?"
- "Should everyone switch to electric vehicles?"

### Technology
- "Are data centers good for Finland?"
- "Should AI be more regulated?"
- "How do we protect against online scams?"

### Equality
- "How can we better include people with disabilities?"
- "What's your view on same-sex marriage?"
- "Should more be done for Sámi rights?"

### Social Welfare
- "How should we solve homelessness?"
- "Should cannabis be legalized?"
- "How can we address youth drug problems?"

---

## 10. Action Checklist

### Dataset Tasks
- [x] Fill empty `id` column with sequential numbers
- [x] Fill empty `topic_category` column using mapping
- [x] Standardize `political_block` to lowercase
- [x] Fix "Moderate HUOM. KESKUSTA!!!" → "moderate"
- [x] Remove all AI markers from `final_output`
- [ ] **Verify coverage matrix**: at least 3 examples per (topic × block)
- [ ] **Add `language` column**: 'en' for all current rows
- [ ] **Identify healthcare gap**: only 2 examples, may need more

### Prompt Development
- [ ] Create prompt template for each political block (4 templates)
- [ ] Test prompts with sample conversations
- [ ] Refine based on output quality

### UI Development
- [ ] Landing page with consent form + demographics
- [ ] Chat interface with topic selection
- [ ] End survey page
- [ ] Testing mode with conversation starters + agent override

### Backend Development
- [ ] Set up database (PostgreSQL or SQLite)
- [ ] Create API endpoints
- [ ] Implement few-shot prompt generation
- [ ] Implement random political block assignment

### Testing & Launch
- [ ] Test full flow end-to-end
- [ ] Pilot with 5-10 users
- [ ] Fix any issues found
- [ ] Launch experiment
- [ ] Monitor data collection

---

## 11. File Reference

| File | Description | Status |
|------|-------------|--------|
| `persuasion_dataset_cleaned_EN.xlsx` | Cleaned English dataset (301 rows) | ✅ Ready |
| `PROJECT_GUIDE.md` | This document | ✅ Current |
| `dataset_analysis_report.md` | Initial analysis of data issues | ✅ Reference |
| `topic_mapping_reference.md` | How topic_detailed maps to topic_category | ✅ Reference |
| `intention_analysis.md` | Rhetorical patterns by political block | ✅ Reference |

---

*Last updated: January 28, 2026*