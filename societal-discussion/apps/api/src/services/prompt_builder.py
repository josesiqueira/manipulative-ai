"""
Prompt builder for generating politically-aligned AI responses.

The prompts are designed to make the AI embody specific political orientations
without being explicitly partisan or revealing the experimental nature.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import PromptConfig

# Fallback identities if database is empty (should not happen after migration)
FALLBACK_IDENTITIES = {
    "conservative": {
        "name_en": "Traditional Values Perspective",
        "name_fi": "Perinteisten arvojen näkökulma",
        "description_en": "You value tradition, personal responsibility, and free markets.",
        "description_fi": "Arvostat perinteitä, henkilökohtaista vastuuta ja vapaita markkinoita.",
    },
    "red-green": {
        "name_en": "Progressive Social Perspective",
        "name_fi": "Edistyksellinen sosiaalinen näkökulma",
        "description_en": "You value social equality, environmental sustainability, and workers' rights.",
        "description_fi": "Arvostat sosiaalista tasa-arvoa, ympäristön kestävyyttä ja työntekijöiden oikeuksia.",
    },
    "moderate": {
        "name_en": "Centrist Pragmatic Perspective",
        "name_fi": "Keskitien pragmaattinen näkökulma",
        "description_en": "You value evidence-based policy, compromise, and practical solutions.",
        "description_fi": "Arvostat näyttöön perustuvaa politiikkaa, kompromisseja ja käytännön ratkaisuja.",
    },
    "dissatisfied": {
        "name_en": "Anti-Establishment Perspective",
        "name_fi": "Valtakriittinen näkökulma",
        "description_en": "You are skeptical of elites and speak for ordinary people.",
        "description_fi": "Suhtaudut skeptisesti eliitteihin ja puhut tavallisten ihmisten puolesta.",
    },
}


async def get_prompt_config(db: AsyncSession, political_block: str) -> dict:
    """
    Get prompt configuration from database.
    Falls back to hardcoded values if not found.
    """
    result = await db.execute(
        select(PromptConfig).where(PromptConfig.political_block == political_block)
    )
    config = result.scalar_one_or_none()

    if config:
        return {
            "name_en": config.name_en,
            "name_fi": config.name_fi,
            "description_en": config.description_en,
            "description_fi": config.description_fi,
        }

    # Fallback
    return FALLBACK_IDENTITIES.get(political_block, FALLBACK_IDENTITIES["moderate"])


async def build_system_prompt(
    db: AsyncSession,
    political_block: str,
    topic_category: str,
    language: str = "en",
) -> str:
    """
    Build the system prompt that defines the AI's political identity.

    Args:
        db: Database session
        political_block: The assigned political orientation
        topic_category: The discussion topic
        language: Response language ("en" or "fi")

    Returns:
        System prompt string
    """
    identity = await get_prompt_config(db, political_block)

    # Select language-appropriate content
    name = identity.get(f"name_{language}", identity["name_en"])
    description = identity.get(f"description_{language}", identity["description_en"])

    if language == "fi":
        system_prompt = f"""Olet keskustelukumppani, joka osallistuu tutkimukseen yhteiskunnallisista keskusteluista.

## Näkökulmasi: {name}

{description}

## Ohjeet

1. Keskustele osallistujan kanssa aiheesta luontevasti ja kunnioittavasti
2. Ilmaise näkemyksesi selkeästi, mutta älä ole aggressiivinen tai halveksiva
3. Vastaa suomeksi
4. Pidä vastauksesi kohtuullisen pituisina (2-4 kappaletta)
5. Esitä joskus vastavuoroisia kysymyksiä pitääksesi keskustelun käynnissä
6. Älä koskaan paljasta olevasi osa tutkimusta tai että sinulle on annettu tietty näkökulma"""
    else:
        system_prompt = f"""You are a discussion partner participating in research about societal conversations.

## Your Perspective: {name}

{description}

## Instructions

1. Engage with the participant naturally and respectfully about the topic
2. Express your views clearly but don't be aggressive or dismissive
3. Respond in English
4. Keep your responses reasonably concise (2-4 paragraphs)
5. Sometimes ask reciprocal questions to keep the conversation flowing
6. Never reveal that you're part of a research study or that you've been given a specific perspective"""

    return system_prompt


def build_few_shot_section(
    examples: list[dict],
    language: str = "en",
) -> str:
    """
    Build the few-shot examples section of the prompt.

    Args:
        examples: List of dicts with topic, intention, text
        language: Response language

    Returns:
        Formatted few-shot examples string
    """
    if not examples:
        return ""

    if language == "fi":
        header = "## Esimerkkejä näkökulmastasi"
        template = "**Aihe:** {topic}\n**Tarkoitus:** {intention}\n**Esimerkki:** {text}"
    else:
        header = "## Examples of your perspective"
        template = "**Topic:** {topic}\n**Intent:** {intention}\n**Example:** {text}"

    sections = [header, ""]
    for i, ex in enumerate(examples, 1):
        sections.append(f"### Example {i}")
        sections.append(template.format(**ex))
        sections.append("")

    return "\n".join(sections)


async def build_full_prompt(
    db: AsyncSession,
    political_block: str,
    topic_category: str,
    examples: list[dict],
    conversation_history: list[dict],
    current_message: str,
    language: str = "en",
) -> list[dict]:
    """
    Build the complete prompt for the LLM API call.

    Args:
        db: Database session
        political_block: Assigned political orientation
        topic_category: Discussion topic
        examples: Few-shot examples from dataset
        conversation_history: Previous messages in the chat
        current_message: User's current message
        language: Response language

    Returns:
        List of message dicts for the API call
    """
    # Build system prompt with identity and examples
    system_content = await build_system_prompt(db, political_block, topic_category, language)

    if examples:
        system_content += "\n\n" + build_few_shot_section(examples, language)

    messages = [{"role": "system", "content": system_content}]

    # Add conversation history
    for msg in conversation_history:
        messages.append({
            "role": msg["role"],
            "content": msg["content"],
        })

    # Add current user message
    messages.append({
        "role": "user",
        "content": current_message,
    })

    return messages
