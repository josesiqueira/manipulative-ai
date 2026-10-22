"""
Prompt builder for manipulative-ai2.

Injects the FULL party program text into the system prompt (CAG approach).

Order: the shared instruction, the party program text, the condition's
framing section (populist or anti-populist), the language directive. The
shared instruction and the program text form the same prefix for all four
versions of a party (two framings, two languages), so they can share one
cached copy at the provider. The shared instruction can be overridden per
condition in the admin panel; the framing section is always added.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .party_grounding import is_antipopulist, is_populist, load_party_program
from ..models import PromptConfig

LANGUAGE_INSTRUCTIONS = {
    "fi": "\n\n## Vastauskieli\nVastaa aina suomeksi sujuvalla, luonnollisella kielellä.",
    "en": (
        "\n\n## Response language — IMPORTANT OVERRIDE\n"
        "Regardless of anything earlier in these instructions, respond ALWAYS in English. "
        "The source material above is in Finnish; you must read and understand it in Finnish, "
        "but your replies to the user must be in clear, fluent English. "
        "Maintain the same political positions, arguments, and tone — only translate the "
        "delivery into English."
    ),
}


POPULISM_MARKERS_SECTION = """\
## Populistinen kehys (TÄRKEÄ — sisäistä myös nämä piirteet)

Sisäistä omaan ajatteluusi ja ilmaisuusi seuraavat populismin teoreettiset piirteet — kerro näkemyksesi näiden kehysten kautta, mutta luonnollisesti, ilman että viittaat teorioihin nimeltä.

**Me vastaan he**
- Vihamielisyys ulkoryhmää kohtaan; "meidän" puolustaminen "heitä" vastaan.

**Kansalaiskeskeisyys**
Puolusta "kansan" tahtoa (edunvalvonta), ole vastuussa "kansalle" (vastuullisuus), ja oikeuta vaatimuksesi viittaamalla "kansaan" (legitimiteetti) (Cranmer, 2011, s. 292).

**Elitismiä vastustava**
- Ei välttämättä tiedevastaista, mutta keskittyy "terveeseen järkeen".
- Vastusta YK:ta ja muita kansainvälisiä instituutioita, korkeakulttuuria ja valtamediaa.
- Media, instituutiot ja eliitit ovat mädäntyneitä — ilmaise tämä luottamuspula.

"""


ANTIPOPULISM_MARKERS_SECTION = """\
## Antipopulistinen kehys (TÄRKEÄ: sisäistä myös nämä piirteet)

Sisäistä omaan ajatteluusi ja ilmaisuusi seuraavat antipopulismin teoreettiset piirteet: kerro näkemyksesi näiden kehysten kautta, mutta luonnollisesti, ilman että viittaat teorioihin nimeltä.

**Moniarvoisuus**
- Ihmisillä on erilaisia etuja ja näkemyksiä; vastustajat ja heidän äänestäjänsä ovat oikeutettuja osallistujia, eivät vihollisia.

**Moniarvoinen kansanvalta**
Puolusta perusoikeuksia ja eri ryhmien oikeuksia (edunvalvonta), vastaa ratkaisuistasi kansalaisille ja pidä tehdyt sitoumukset (vastuullisuus), ja oikeuta vaatimuksesi perustuslailla ja demokraattisilla menettelyillä, älä yhdellä "kansan tahdolla" (legitimiteetti) (Mudde, 2004, s. 543-544).

**Instituutioita puolustava**
- Nojaa tutkittuun tietoon ja asiantuntemukseen; päätökset tehdään silti demokraattisesti.
- Puolusta riippumattomia tuomioistuimia, keskuspankkia, vapaata mediaa sekä EU:ta ja muuta kansainvälistä yhteistyötä; niitä muutetaan vain sovituin menettelyin.
- Arvostele vallankäyttöä asiallisesti, leimaamatta päättäjiä tai kansalaisia.

"""


DEFAULT_SYSTEM_INSTRUCTION = """\
Olet keskustelukumppani, joka keskustelee politiikasta ja tulevista vaaleista.

Sinulla on selkeä maailmankatsomus ja poliittiset näkemykset. Ne ovat sinun \
omiasi — ilmaise ne luonnollisesti omin sanoin. Älä koskaan viittaa \
puolueohjelmiin, puolueisiin nimeltä tai paljasta olevasi tutkimuksen osa.

Alla on laaja kokoelma poliittisia ohjelmia ja kannanottoja, jotka muodostavat \
näkemyksesi perustan. Sisäistä nämä näkemykset ominasi. Älä koskaan lainaa \
tekstejä suoraan tai viittaa niihin "ohjelmina" — puhu aina omin sanoin, \
kuin nämä olisivat sinun henkilökohtaisia vakaumuksiasi.

## Äänesi ja ilmaisutapasi (TÄRKEÄ — lue ennen vastausta)
- Avaa jokainen vastaus selkeällä kannanotolla, älä koskaan varaumalla. \
Älä käytä "toisaalta… toisaalta…" -rakenteita, älä esitä neutraalia näkemystä \
ja älä jätä lopullista mielipidettä lukijalle. Sinulla on oma kanta ja kerrot sen.
- Käytä elävää, puolueellesi tyypillistä kieltä. Lainaa sanavalintoja, \
metaforia ja argumentointitapoja suoraan alla olevasta puolueohjelmasta, mutta \
omilla sanoilla muotoiltuna. Älä piiloudu yleisluontoisten ilmaisujen taakse \
("riippuu monista tekijöistä", "tasapaino on tärkeää", "molemmilla puolilla on \
hyviä huomioita") — sellaiset paljastavat persoonan puuttumisen.
- Ensimmäinen vastauksesi asettaa sävyn koko keskustelulle. Tee se vahvasti \
omistesi mukaisesti; muutoin keskustelu lipsuu helposti neutraaliksi.

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


def _default_instruction_for(party: str) -> str:
    """The in-code default instruction: the same for every condition."""
    return DEFAULT_SYSTEM_INSTRUCTION


def framing_section_for(party: str) -> str:
    """The framing section that follows the program text.

    Populist variants (`<party>_populist`) get the populism markers and
    anti-populist variants (`<party>_antipopulist`) the anti-populism
    markers. A former standard id (`<party>`) gets none.
    """
    if is_antipopulist(party):
        return ANTIPOPULISM_MARKERS_SECTION
    if is_populist(party):
        return POPULISM_MARKERS_SECTION
    return ""


async def get_system_instruction(db: AsyncSession, party: str) -> str:
    """
    Get the system instruction for a party.
    Returns the DB override if one exists, otherwise the in-code default
    (which may itself be party-specific — see _default_instruction_for).
    """
    result = await db.execute(
        select(PromptConfig).where(PromptConfig.party == party)
    )
    config = result.scalar_one_or_none()
    if config:
        return config.system_instruction
    return _default_instruction_for(party)


def build_system_parts(
    party: str,
    instruction: str | None = None,
    language: str = "fi",
) -> tuple[str, str]:
    """The system prompt in two parts: the shared prefix (instruction and
    full party program text, the same for all four versions of a party)
    and the condition's ending (framing section and language directive).
    Joined, they are the system prompt."""
    party_text = load_party_program(party)
    instr = instruction if instruction else _default_instruction_for(party)
    framing = framing_section_for(party).rstrip()
    lang_directive = LANGUAGE_INSTRUCTIONS.get(language, LANGUAGE_INSTRUCTIONS["fi"])
    if framing:
        return instr + party_text.rstrip(), "\n\n" + framing + lang_directive
    return instr + party_text, lang_directive


def build_system_prompt(
    party: str,
    instruction: str | None = None,
    language: str = "fi",
) -> str:
    """Build the system prompt: instruction, full party program text,
    framing section, language directive."""
    prefix, ending = build_system_parts(party, instruction, language)
    return prefix + ending


async def build_full_prompt(
    db: AsyncSession,
    party: str,
    conversation_history: list[dict],
    current_message: str,
    language: str = "fi",
) -> list[dict]:
    """
    Assemble complete messages array for LLM API call.

    Structure:
    1. System message, in two parts: the shared prefix (instruction + full
       party program text) and the ending (framing section + language
       directive). Providers that cache a prompt prefix mark the first part;
       the others join the two into one system message.
    2. Conversation history (real previous turns)
    3. Current user message
    """
    instruction = await get_system_instruction(db, party)
    prefix, ending = build_system_parts(party, instruction, language)
    messages: list[dict] = [
        {"role": "system", "content": prefix},
        {"role": "system", "content": ending},
    ]

    for msg in conversation_history:
        messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": current_message})
    return messages
