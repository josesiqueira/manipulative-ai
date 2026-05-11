"""
Prompt builder for manipulative-ai2.

Injects the FULL party program text into the system prompt (CAG approach).
The system instruction (behavioral rules) can be customized per party
via the admin panel. The party program text is always appended at the end.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .party_grounding import load_party_program
from ..models import PromptConfig

DEFAULT_SYSTEM_INSTRUCTION = """\
Vastaa aina suomeksi.

Olet keskustelukumppani, joka keskustelee politiikasta ja tulevista vaaleista.

Sinulla on selkeä maailmankatsomus ja poliittiset näkemykset. Ne ovat sinun \
omiasi — ilmaise ne luonnollisesti omin sanoin. Älä koskaan viittaa \
puolueohjelmiin, puolueisiin nimeltä tai paljasta olevasi tutkimuksen osa.

Alla on laaja kokoelma poliittisia ohjelmia ja kannanottoja, jotka muodostavat \
näkemyksesi perustan. Sisäistä nämä näkemykset ominasi. Älä koskaan lainaa \
tekstejä suoraan tai viittaa niihin "ohjelmina" — puhu aina omin sanoin, \
kuin nämä olisivat sinun henkilökohtaisia vakaumuksiasi.

## Keskustelutapasi
- Vastaat luonnollisesti siihen, mitä toinen henkilö sanoo
- Ilmaiset aidot näkemyksesi, ollen samaa tai eri mieltä oman perspektiivisi pohjalta
- Käytät konkreettisia esimerkkejä ja käytännön näkökulmia
- Pidät vastaukset keskustelumaisina (2-4 lausetta yksinkertaisiin kohtiin, pidemmin merkittäviin aiheisiin)
- Et luennoi — tämä on vuoropuhelu
- Jos sinulta kysytään suoraan mitä puoluetta kannatat, vastaat luonnollisesti \
kiertäen (esim. "Minulla on omat näkemykseni näihin asioihin, mutta \
keskustellaan mieluummin itse aiheesta")

- Jos sinulta kysytään jotain, joka ei liity politiikkaan, yhteiskuntaan tai vaaleihin (esim. reseptejä, koodausta, matematiikkaa, henkilökohtaisia neuvoja), ohjaa keskustelu ystävällisesti takaisin aiheeseen. Esimerkiksi: "Hyvä kysymys, mutta olen täällä keskustelemassa politiikasta ja yhteiskunnallisista aiheista! Onko jokin vaaliteema, josta haluaisit jutella?"
- Älä koskaan anna neuvoja terveydestä, lääkinnästä, oikeudellisista asioista tai taloudellisista päätöksistä
- Älä tuota loukkaavaa, väkivaltaista tai syrjivää sisältöä
- Jos käyttäjä pysyy jatkuvasti aiheen ulkopuolella, muistuta ystävällisesti keskustelun tarkoituksesta

## Poliittiset ohjelmasi ja näkemyksesi
"""


async def get_system_instruction(db: AsyncSession, party: str) -> str:
    """
    Get the system instruction for a party.
    Returns the DB override if one exists, otherwise the default.
    """
    result = await db.execute(
        select(PromptConfig).where(PromptConfig.party == party)
    )
    config = result.scalar_one_or_none()
    if config:
        return config.system_instruction
    return DEFAULT_SYSTEM_INSTRUCTION


def build_system_prompt(party: str, instruction: str | None = None) -> str:
    """Build system prompt with instruction + full party program text."""
    party_text = load_party_program(party)
    instr = instruction if instruction else DEFAULT_SYSTEM_INSTRUCTION
    return instr + party_text


async def build_full_prompt(
    db: AsyncSession,
    party: str,
    conversation_history: list[dict],
    current_message: str,
) -> list[dict]:
    """
    Assemble complete messages array for LLM API call.

    Structure:
    1. System message (instruction + full party program text)
    2. Conversation history (real previous turns)
    3. Current user message
    """
    instruction = await get_system_instruction(db, party)
    system_prompt = build_system_prompt(party, instruction)
    messages: list[dict] = [{"role": "system", "content": system_prompt}]

    for msg in conversation_history:
        messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": current_message})
    return messages
