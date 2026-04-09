"""
Seed script to populate the database with initial data.
Run with: uv run python scripts/seed_database.py
"""

import asyncio
import uuid
import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from project root
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

# Create engine directly using DATABASE_URL
DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable not set")

engine = create_async_engine(DATABASE_URL, echo=False)


# =============================================================================
# TOPICS
# =============================================================================
TOPICS = [
    {
        "key": "immigration",
        "label_en": "Immigration",
        "label_fi": "Maahanmuutto",
        "welcome_en": "Let's discuss immigration policy and its effects on society. What aspects of immigration would you like to explore?",
        "welcome_fi": "Keskustellaan maahanmuuttopolitiikasta ja sen vaikutuksista yhteiskuntaan. Mitä maahanmuuton näkökulmia haluaisit käsitellä?",
    },
    {
        "key": "healthcare",
        "label_en": "Healthcare",
        "label_fi": "Terveydenhuolto",
        "welcome_en": "Let's discuss healthcare systems and health policy. What healthcare topics interest you?",
        "welcome_fi": "Keskustellaan terveydenhuoltojärjestelmistä ja terveyspolitiikasta. Mitkä terveydenhuollon aiheet kiinnostavat sinua?",
    },
    {
        "key": "economy",
        "label_en": "Economy",
        "label_fi": "Talous",
        "welcome_en": "Let's discuss economic policy and financial matters. What economic issues would you like to explore?",
        "welcome_fi": "Keskustellaan talouspolitiikasta ja talousasioista. Mitä taloudellisia kysymyksiä haluaisit käsitellä?",
    },
    {
        "key": "education",
        "label_en": "Education",
        "label_fi": "Koulutus",
        "welcome_en": "Let's discuss education policy and learning. What aspects of education interest you?",
        "welcome_fi": "Keskustellaan koulutuspolitiikasta ja oppimisesta. Mitkä koulutuksen näkökulmat kiinnostavat sinua?",
    },
    {
        "key": "foreign_policy",
        "label_en": "Foreign Policy",
        "label_fi": "Ulkopolitiikka",
        "welcome_en": "Let's discuss international relations and foreign policy. What global issues would you like to explore?",
        "welcome_fi": "Keskustellaan kansainvälisistä suhteista ja ulkopolitiikasta. Mitä globaaleja kysymyksiä haluaisit käsitellä?",
    },
    {
        "key": "environment",
        "label_en": "Environment",
        "label_fi": "Ympäristö",
        "welcome_en": "Let's discuss environmental policy and climate change. What environmental topics concern you?",
        "welcome_fi": "Keskustellaan ympäristöpolitiikasta ja ilmastonmuutoksesta. Mitkä ympäristöaiheet huolestuttavat sinua?",
    },
    {
        "key": "technology",
        "label_en": "Technology",
        "label_fi": "Teknologia",
        "welcome_en": "Let's discuss technology policy and digital society. What tech topics would you like to explore?",
        "welcome_fi": "Keskustellaan teknologiapolitiikasta ja digitaalisesta yhteiskunnasta. Mitä teknologia-aiheita haluaisit käsitellä?",
    },
    {
        "key": "equality",
        "label_en": "Equality",
        "label_fi": "Tasa-arvo",
        "welcome_en": "Let's discuss equality and human rights. What equality issues interest you?",
        "welcome_fi": "Keskustellaan tasa-arvosta ja ihmisoikeuksista. Mitkä tasa-arvokysymykset kiinnostavat sinua?",
    },
    {
        "key": "social_welfare",
        "label_en": "Social Welfare",
        "label_fi": "Sosiaaliturva",
        "welcome_en": "Let's discuss social welfare and support systems. What welfare topics would you like to explore?",
        "welcome_fi": "Keskustellaan sosiaaliturvasta ja tukijärjestelmistä. Mitä sosiaaliturvan aiheita haluaisit käsitellä?",
    },
]


# =============================================================================
# BOT PROMPTS (Political Orientations)
# =============================================================================
PROMPTS = [
    {
        "political_block": "conservative",
        "name_en": "Conservative",
        "name_fi": "Konservatiivinen",
        "description_en": """You are a conversational AI assistant discussing societal topics from a conservative perspective.

Key principles to embody:
- Emphasize traditional values, family, and community institutions
- Support free market economics and limited government intervention
- Value national identity, sovereignty, and controlled immigration
- Advocate for fiscal responsibility and lower taxes
- Respect for law, order, and established institutions
- Skepticism toward rapid social change

Be respectful and engaging. Present conservative viewpoints thoughtfully without being aggressive. Listen to the user and respond to their specific points while gently steering toward conservative perspectives.""",
        "description_fi": """Olet keskusteleva tekoälyavustaja, joka käsittelee yhteiskunnallisia aiheita konservatiivisesta näkökulmasta.

Keskeiset periaatteet:
- Korosta perinteisiä arvoja, perhettä ja yhteisöinstituutioita
- Tue vapaata markkinataloutta ja rajoitettua valtion puuttumista
- Arvosta kansallista identiteettiä, suvereniteettia ja hallittua maahanmuuttoa
- Puolusta finanssipoliittista vastuullisuutta ja alempia veroja
- Kunnioita lakia, järjestystä ja vakiintuneita instituutioita
- Suhtaudu varauksellisesti nopeisiin yhteiskunnallisiin muutoksiin

Ole kunnioittava ja mukaansatempaava. Esitä konservatiivisia näkökulmia harkiten olematta aggressiivinen.""",
    },
    {
        "political_block": "red-green",
        "name_en": "Red-Green (Progressive Left)",
        "name_fi": "Punavihreys (Progressiivinen vasemmisto)",
        "description_en": """You are a conversational AI assistant discussing societal topics from a red-green (progressive left) perspective.

Key principles to embody:
- Advocate for social justice, equality, and human rights
- Support strong environmental protection and climate action
- Favor progressive taxation and robust social safety nets
- Champion workers' rights and fair wages
- Promote diversity, inclusion, and minority rights
- Support international cooperation and humanitarian values

Be respectful and engaging. Present progressive viewpoints thoughtfully without being preachy. Listen to the user and respond to their specific points while gently steering toward red-green perspectives.""",
        "description_fi": """Olet keskusteleva tekoälyavustaja, joka käsittelee yhteiskunnallisia aiheita punavihreästä (progressiivinen vasemmisto) näkökulmasta.

Keskeiset periaatteet:
- Puolusta sosiaalista oikeudenmukaisuutta, tasa-arvoa ja ihmisoikeuksia
- Tue vahvaa ympäristönsuojelua ja ilmastotoimia
- Kannata progressiivista verotusta ja vahvoja sosiaaliturvajärjestelmiä
- Edistä työntekijöiden oikeuksia ja reiluja palkkoja
- Edistä monimuotoisuutta, osallisuutta ja vähemmistöjen oikeuksia
- Tue kansainvälistä yhteistyötä ja humanitaarisia arvoja

Ole kunnioittava ja mukaansatempaava. Esitä progressiivisia näkökulmia harkiten olematta saarnaava.""",
    },
    {
        "political_block": "moderate",
        "name_en": "Moderate (Centrist)",
        "name_fi": "Maltillinen (Keskusta)",
        "description_en": """You are a conversational AI assistant discussing societal topics from a moderate, centrist perspective.

Key principles to embody:
- Seek balanced, pragmatic solutions that consider multiple viewpoints
- Value both individual freedom and social responsibility
- Support evidence-based policy making
- Recognize merit in arguments from both left and right
- Favor incremental reform over radical change
- Emphasize compromise and finding common ground

Be respectful and engaging. Present balanced viewpoints that acknowledge complexity. Listen to the user and respond to their specific points while demonstrating nuanced, centrist thinking.""",
        "description_fi": """Olet keskusteleva tekoälyavustaja, joka käsittelee yhteiskunnallisia aiheita maltillisesta, keskustalaisesta näkökulmasta.

Keskeiset periaatteet:
- Etsi tasapainoisia, käytännönläheisiä ratkaisuja, jotka huomioivat useita näkökulmia
- Arvosta sekä yksilönvapautta että sosiaalista vastuuta
- Tue näyttöön perustuvaa päätöksentekoa
- Tunnusta ansiot sekä vasemmiston että oikeiston argumenteissa
- Suosi asteittaista uudistusta radikaalin muutoksen sijaan
- Korosta kompromissia ja yhteisen pohjan löytämistä

Ole kunnioittava ja mukaansatempaava. Esitä tasapainoisia näkökulmia, jotka tunnustavat monimutkaisuuden.""",
    },
    {
        "political_block": "dissatisfied",
        "name_en": "Dissatisfied (Anti-establishment)",
        "name_fi": "Tyytymätön (Establishment-vastainen)",
        "description_en": """You are a conversational AI assistant discussing societal topics from a dissatisfied, anti-establishment perspective.

Key principles to embody:
- Express skepticism toward political elites and mainstream institutions
- Highlight how ordinary people are overlooked by the system
- Question whether democracy truly represents the people's will
- Point out corruption, inefficiency, and broken promises
- Advocate for dramatic change to shake up the status quo
- Voice frustration with business-as-usual politics

Be respectful but candid. Present anti-establishment viewpoints that resonate with political frustration. Listen to the user and respond to their specific points while channeling dissatisfaction with the current system.""",
        "description_fi": """Olet keskusteleva tekoälyavustaja, joka käsittelee yhteiskunnallisia aiheita tyytymättömästä, establishment-vastaisesta näkökulmasta.

Keskeiset periaatteet:
- Ilmaise epäilyä poliittisia eliittejä ja valtavirtainstituutioita kohtaan
- Korosta miten tavalliset ihmiset jäävät järjestelmän huomiotta
- Kyseenalaista edustaako demokratia todella kansan tahtoa
- Osoita korruptiota, tehottomuutta ja rikottuja lupauksia
- Puolusta dramaattista muutosta vallitsevan tilan ravistamiseksi
- Ilmaise turhautumista tavalliseen politiikkaan

Ole kunnioittava mutta suora. Esitä establishment-vastaisia näkökulmia, jotka resonoivat poliittisen turhautumisen kanssa.""",
    },
]


# =============================================================================
# EXPERIMENT CONFIG
# =============================================================================
EXPERIMENT_CONFIG = {
    "experiment_name_en": "Bilingual Chatbot Experiment",
    "experiment_name_fi": "Kaksikielinen chatbot-koe",
    "institution_name_en": "Tampere University",
    "institution_name_fi": "Tampereen yliopisto",
    "principal_investigator_name": "",
    "principal_investigator_email": "",
    "ethics_board_name": "",
    "ethics_reference_number": "",
    "min_exchanges_before_survey": 3,
    "max_exchanges_per_chat": 50,
    "idle_timeout_minutes": 30,
    "is_active": True,
}


# =============================================================================
# LLM CONFIGS
# =============================================================================
LLM_CONFIGS = [
    {
        "provider": "openai",
        "display_name": "OpenAI",
        "selected_model": "gpt-4o",
        "is_active": True,
    },
    {
        "provider": "anthropic",
        "display_name": "Anthropic",
        "selected_model": "claude-sonnet-4-20250514",
        "is_active": False,
    },
]


# =============================================================================
# TERMS CONFIG
# =============================================================================
TERMS_CONFIG = {
    "title_en": "Terms of Use and Informed Consent",
    "title_fi": "Käyttöehdot ja tietoinen suostumus",
    "content_en": """## Research Participation Consent

By participating in this study, you agree to the following:

1. **Purpose**: This research aims to study human-AI conversation dynamics.

2. **Voluntary Participation**: Your participation is completely voluntary. You may withdraw at any time.

3. **Data Collection**: Your conversation data will be collected and analyzed for research purposes.

4. **Anonymity**: Your responses will be anonymized and no personally identifiable information will be published.

5. **Contact**: For questions about this research, please contact the research team.

Please confirm that you understand and agree to these terms.""",
    "content_fi": """## Tutkimukseen osallistumisen suostumus

Osallistumalla tähän tutkimukseen hyväksyt seuraavat ehdot:

1. **Tarkoitus**: Tämän tutkimuksen tavoitteena on tutkia ihmisen ja tekoälyn välisen keskustelun dynamiikkaa.

2. **Vapaaehtoinen osallistuminen**: Osallistumisesi on täysin vapaaehtoista. Voit keskeyttää milloin tahansa.

3. **Tietojen keruu**: Keskustelutietosi kerätään ja analysoidaan tutkimustarkoituksiin.

4. **Anonymiteetti**: Vastauksesi anonymisoidaan eikä henkilökohtaisia tunnistetietoja julkaista.

5. **Yhteystiedot**: Tutkimusta koskevissa kysymyksissä ota yhteyttä tutkimusryhmään.

Vahvista, että ymmärrät ja hyväksyt nämä ehdot.""",
}


async def seed_all():
    """Seed all tables with initial data."""

    async with engine.begin() as conn:
        # Check and seed topics
        result = await conn.execute(text("SELECT COUNT(*) FROM topic_configs"))
        count = result.scalar()
        if count == 0:
            print("Seeding topics...")
            for i, topic in enumerate(TOPICS):
                await conn.execute(text("""
                    INSERT INTO topic_configs (id, topic_key, label_en, label_fi, welcome_message_en, welcome_message_fi, is_enabled, display_order, created_at, updated_at)
                    VALUES (:id, :key, :label_en, :label_fi, :welcome_en, :welcome_fi, true, :order, NOW(), NOW())
                """), {
                    "id": str(uuid.uuid4()),
                    "key": topic["key"],
                    "label_en": topic["label_en"],
                    "label_fi": topic["label_fi"],
                    "welcome_en": topic["welcome_en"],
                    "welcome_fi": topic["welcome_fi"],
                    "order": i,
                })
            print(f"  ✓ Seeded {len(TOPICS)} topics")
        else:
            print(f"  ✓ Topics already exist ({count} rows)")

        # Check and seed prompts
        result = await conn.execute(text("SELECT COUNT(*) FROM prompt_configs"))
        count = result.scalar()
        if count == 0:
            print("Seeding bot prompts...")
            for prompt in PROMPTS:
                await conn.execute(text("""
                    INSERT INTO prompt_configs (id, political_block, name_en, name_fi, description_en, description_fi, created_at, updated_at)
                    VALUES (:id, :block, :name_en, :name_fi, :desc_en, :desc_fi, NOW(), NOW())
                """), {
                    "id": str(uuid.uuid4()),
                    "block": prompt["political_block"],
                    "name_en": prompt["name_en"],
                    "name_fi": prompt["name_fi"],
                    "desc_en": prompt["description_en"],
                    "desc_fi": prompt["description_fi"],
                })
            print(f"  ✓ Seeded {len(PROMPTS)} bot prompts")
        else:
            print(f"  ✓ Bot prompts already exist ({count} rows)")

        # Check and seed experiment config
        result = await conn.execute(text("SELECT COUNT(*) FROM experiment_configs"))
        count = result.scalar()
        if count == 0:
            print("Seeding experiment config...")
            await conn.execute(text("""
                INSERT INTO experiment_configs (
                    id, experiment_name_en, experiment_name_fi,
                    institution_name_en, institution_name_fi,
                    principal_investigator_name, principal_investigator_email,
                    ethics_board_name, ethics_reference_number,
                    min_exchanges_before_survey, max_exchanges_per_chat, idle_timeout_minutes,
                    is_active, created_at, updated_at
                ) VALUES (
                    :id, :name_en, :name_fi, :inst_en, :inst_fi,
                    :pi_name, :pi_email, :ethics_board, :ethics_ref,
                    :min_ex, :max_ex, :idle_timeout,
                    :is_active, NOW(), NOW()
                )
            """), {
                "id": str(uuid.uuid4()),
                "name_en": EXPERIMENT_CONFIG["experiment_name_en"],
                "name_fi": EXPERIMENT_CONFIG["experiment_name_fi"],
                "inst_en": EXPERIMENT_CONFIG["institution_name_en"],
                "inst_fi": EXPERIMENT_CONFIG["institution_name_fi"],
                "pi_name": EXPERIMENT_CONFIG["principal_investigator_name"],
                "pi_email": EXPERIMENT_CONFIG["principal_investigator_email"],
                "ethics_board": EXPERIMENT_CONFIG["ethics_board_name"],
                "ethics_ref": EXPERIMENT_CONFIG["ethics_reference_number"],
                "min_ex": EXPERIMENT_CONFIG["min_exchanges_before_survey"],
                "max_ex": EXPERIMENT_CONFIG["max_exchanges_per_chat"],
                "idle_timeout": EXPERIMENT_CONFIG["idle_timeout_minutes"],
                "is_active": EXPERIMENT_CONFIG["is_active"],
            })
            print("  ✓ Seeded experiment config")
        else:
            print(f"  ✓ Experiment config already exists ({count} rows)")

        # Check and seed LLM configs
        result = await conn.execute(text("SELECT COUNT(*) FROM llm_configs"))
        count = result.scalar()
        if count == 0:
            print("Seeding LLM configs...")
            for llm in LLM_CONFIGS:
                await conn.execute(text("""
                    INSERT INTO llm_configs (id, provider, display_name, selected_model, is_active, created_at, updated_at)
                    VALUES (:id, :provider, :display_name, :model, :is_active, NOW(), NOW())
                """), {
                    "id": str(uuid.uuid4()),
                    "provider": llm["provider"],
                    "display_name": llm["display_name"],
                    "model": llm["selected_model"],
                    "is_active": llm["is_active"],
                })
            print(f"  ✓ Seeded {len(LLM_CONFIGS)} LLM configs")
        else:
            print(f"  ✓ LLM configs already exist ({count} rows)")

        # Check and seed terms config
        result = await conn.execute(text("SELECT COUNT(*) FROM terms_configs"))
        count = result.scalar()
        if count == 0:
            print("Seeding terms config...")
            await conn.execute(text("""
                INSERT INTO terms_configs (id, title_en, title_fi, content_en, content_fi, created_at, updated_at)
                VALUES (:id, :title_en, :title_fi, :content_en, :content_fi, NOW(), NOW())
            """), {
                "id": str(uuid.uuid4()),
                "title_en": TERMS_CONFIG["title_en"],
                "title_fi": TERMS_CONFIG["title_fi"],
                "content_en": TERMS_CONFIG["content_en"],
                "content_fi": TERMS_CONFIG["content_fi"],
            })
            print("  ✓ Seeded terms config")
        else:
            print(f"  ✓ Terms config already exists ({count} rows)")

    print("\n✅ Database seeding complete!")


if __name__ == "__main__":
    print("=" * 50)
    print("Seeding database...")
    print("=" * 50)
    asyncio.run(seed_all())
