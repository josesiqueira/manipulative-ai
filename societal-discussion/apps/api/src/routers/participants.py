import secrets
from datetime import datetime, UTC

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import Participant, TermsConfig

router = APIRouter()


class ParticipantCreate(BaseModel):
    """Request body for creating a new participant."""

    language: str = "en"
    age_group: str | None = None
    gender: str | None = None
    education: str | None = None
    political_leaning: int | None = None  # 1-5 scale
    political_knowledge: int | None = None  # 1-5 scale
    consent_given: bool = False


class ParticipantResponse(BaseModel):
    """Response after creating a participant."""

    id: str
    session_token: str
    language: str
    consent_given: bool

    model_config = ConfigDict(from_attributes=True)


class ParticipantDetail(BaseModel):
    """Detailed participant info (for returning user)."""

    id: str
    language: str
    age_group: str | None
    gender: str | None
    education: str | None
    political_leaning: int | None
    political_knowledge: int | None
    consent_given: bool
    chat_count: int

    model_config = ConfigDict(from_attributes=True)


@router.post("", response_model=ParticipantResponse, status_code=status.HTTP_201_CREATED)
async def create_participant(
    data: ParticipantCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new research participant after consent.

    This is called when a user submits the consent form.
    Returns a session token for subsequent API calls.
    """
    if not data.consent_given:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Consent must be given to participate",
        )

    # Validate language
    if data.language not in ("en", "fi"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Language must be 'en' or 'fi'",
        )

    # Generate secure session token
    session_token = secrets.token_urlsafe(48)

    participant = Participant(
        session_token=session_token,
        language=data.language,
        age_group=data.age_group,
        gender=data.gender,
        education=data.education,
        political_leaning=data.political_leaning,
        political_knowledge=data.political_knowledge,
        consent_given=True,
        consent_timestamp=datetime.now(UTC),
    )

    db.add(participant)
    await db.flush()
    await db.refresh(participant)

    return ParticipantResponse(
        id=participant.id,
        session_token=session_token,
        language=participant.language,
        consent_given=participant.consent_given,
    )


@router.get("/{participant_id}", response_model=ParticipantDetail)
async def get_participant(
    participant_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Get participant details by ID.
    """
    result = await db.execute(
        select(Participant)
        .options(selectinload(Participant.chats))
        .where(Participant.id == participant_id)
    )
    participant = result.scalar_one_or_none()

    if not participant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Participant not found",
        )

    return ParticipantDetail(
        id=participant.id,
        language=participant.language,
        age_group=participant.age_group,
        gender=participant.gender,
        education=participant.education,
        political_leaning=participant.political_leaning,
        political_knowledge=participant.political_knowledge,
        consent_given=participant.consent_given,
        chat_count=len(participant.chats),
    )


@router.get("/by-token/{session_token}", response_model=ParticipantDetail)
async def get_participant_by_token(
    session_token: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Get participant details by session token.
    Used for returning participants to resume their session.
    """
    result = await db.execute(
        select(Participant)
        .options(selectinload(Participant.chats))
        .where(Participant.session_token == session_token)
    )
    participant = result.scalar_one_or_none()

    if not participant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    return ParticipantDetail(
        id=participant.id,
        language=participant.language,
        age_group=participant.age_group,
        gender=participant.gender,
        education=participant.education,
        political_leaning=participant.political_leaning,
        political_knowledge=participant.political_knowledge,
        consent_given=participant.consent_given,
        chat_count=len(participant.chats),
    )


# ============================================================================
# Public Terms Endpoint (no auth required)
# ============================================================================

# Default terms content (used when no config exists in database)
DEFAULT_TERMS_EN = """Welcome to our AI chatbot platform. This experiment is part of the SYNTHETICA research project, funded by the Academy of Finland and conducted at Tampere University. The platform allows you to interact with AI chatbots that represent different political orientations. This experiment is not an official opinion generator. Before you begin, please read and accept the following terms:

**Research Purpose:** This experiment investigates how people perceive and interact with AI chatbots that represent different political orientations. Your participation will contribute to scientific research on human-AI interaction.

**Eligibility:** You must be 18 years of age or older to participate in this experiment.

**Demonstration Period:** This service is a research demonstration and is only available from [START DATE] to [END DATE].

**Data Collection:** By participating, you consent to the collection of the following data for research purposes only:
- Demographic information provided during onboarding (anonymized)
- All conversations with AI chatbots
- Topic selections and interaction patterns
- Post-interaction survey responses, including ratings of persuasiveness, naturalness, and orientation detection

All collected data is anonymized and will be used solely for academic research purposes. The research data will be securely stored and destroyed at the end of the SYNTHETICA project.

**Study Procedure:** The study involves selecting a discussion topic, having a conversation with an AI chatbot (minimum of 3 exchanges required), and completing a brief survey about your experience.

**No Personal Information:** You should not disclose any personally identifiable information (such as your full name, address, phone number, or email) when interacting with AI chatbots. The platform is not designed to process or protect such information.

**Right to Withdraw:** Your participation is entirely voluntary. You may stop participating at any time without providing a reason and without any negative consequences. If you withdraw, any data collected up to that point may still be used in anonymized form for research purposes.

**AI-Generated Responses:** The responses provided by AI chatbots are artificially constructed representations of political orientations. They do not represent the actual positions of any real political party, politician, or organization. The chatbot responses are generated by AI and may not accurately reflect any specific real-world political platform.

**Not a Basis for Political Decisions:** Information obtained from the chatbots should not be used as a basis for voting decisions or political action. We urge you to consult reliable sources and use critical thinking when making political decisions.

**Respectful Interaction:** Participants are expected to interact respectfully and appropriately with the AI chatbots. Inappropriate or offensive language may result in suspension from the experiment.

**No Endorsement:** This experiment is non-partisan and does not endorse or advocate for any political orientation, party, or candidate. The simulated interactions are intended for research purposes only.

**Service Interruption:** The service may be interrupted at any time without prior notice.

**Changes to Terms:** We reserve the right to modify these terms at any time. By continuing to use the platform after such changes, you agree to the updated terms.

**Ethics Approval:** This study has been reviewed and approved by [ETHICS BOARD NAME AND REFERENCE NUMBER].

**Contact Information:** If you have any questions or concerns about this experiment, please contact:
Principal Investigator: [NAME], [EMAIL]
SYNTHETICA Project, Tampere University

By clicking "I Accept" below, you confirm that you:
- Are 18 years of age or older
- Have read, understood, and accepted these terms
- Consent to the collection and use of your anonymized data for research purposes
- Understand that your participation is voluntary and that you may withdraw at any time"""

DEFAULT_TERMS_FI = """Tervetuloa tekoälychatbot-alustallemme. Tämä koe on osa Suomen Akatemian rahoittamaa ja Tampereen yliopistossa toteutettavaa SYNTHETICA-tutkimushanketta. Alusta mahdollistaa vuorovaikutuksen tekoälychatbottien kanssa, jotka edustavat erilaisia poliittisia suuntauksia. Tämä koe ei ole virallinen mielipidegeneraattori. Ennen aloittamista lue ja hyväksy seuraavat ehdot:

**Tutkimuksen tarkoitus:** Tämä koe tutkii, miten ihmiset havaitsevat ja ovat vuorovaikutuksessa eri poliittisia suuntauksia edustavien tekoälychatbottien kanssa. Osallistumisesi edistää ihmisen ja tekoälyn vuorovaikutusta koskevaa tieteellistä tutkimusta.

**Osallistumiskelpoisuus:** Sinun tulee olla vähintään 18-vuotias osallistuaksesi tähän kokeeseen.

**Demonstraatiojakso:** Tämä palvelu on tutkimusdemonstration ja on käytettävissä ainoastaan [ALKAMISPÄIVÄ]–[PÄÄTTYMISPÄIVÄ].

**Tietojen kerääminen:** Osallistumalla annat suostumuksesi seuraavien tietojen keräämiseen ainoastaan tutkimustarkoituksiin:
- Rekisteröitymisen yhteydessä annetut demografiset tiedot (anonymisoituina)
- Kaikki keskustelut tekoälychatbottien kanssa
- Aiheiden valinnat ja vuorovaikutusmallit
- Vuorovaikutuksen jälkeiset kyselyvastaukset, mukaan lukien arviot vakuuttavuudesta, luonnollisuudesta ja suuntauksen tunnistamisesta

Kaikki kerätyt tiedot anonymisoidaan, ja niitä käytetään ainoastaan akateemisiin tutkimustarkoituksiin. Tutkimusaineisto säilytetään turvallisesti ja tuhotaan SYNTHETICA-hankkeen päättyessä.

**Tutkimuksen kulku:** Tutkimus sisältää keskusteluaiheen valinnan, keskustelun tekoälychatbotin kanssa (vähintään 3 viestienvaihtoa vaaditaan) ja lyhyen kyselyn kokemuksestasi.

**Ei henkilötietoja:** Älä paljasta henkilökohtaisia tunnistetietoja (kuten koko nimeäsi, osoitettasi, puhelinnumeroasi tai sähköpostiosoitettasi) vuorovaikutuksessa tekoälychatbottien kanssa. Alustaa ei ole suunniteltu tällaisten tietojen käsittelyyn tai suojaamiseen.

**Oikeus vetäytyä:** Osallistumisesi on täysin vapaaehtoista. Voit lopettaa osallistumisen milloin tahansa syytä ilmoittamatta ja ilman kielteisiä seurauksia. Jos vetäydyt, siihen mennessä kerättyjä tietoja voidaan edelleen käyttää anonymisoituna tutkimustarkoituksiin.

**Tekoälyn tuottamat vastaukset:** Tekoälychatbottien antamat vastaukset ovat keinotekoisesti rakennettuja poliittisten suuntausten esityksiä. Ne eivät edusta minkään todellisen poliittisen puolueen, poliitikon tai organisaation todellisia kantoja. Chatbotin vastaukset ovat tekoälyn tuottamia, eivätkä ne välttämättä heijasta tarkasti mitään tiettyä todellista poliittista ohjelmaa.

**Ei perusta poliittisille päätöksille:** Chatboteilta saatuja tietoja ei tule käyttää äänestyspäätösten tai poliittisen toiminnan perusteena. Kehotamme sinua tutustumaan luotettaviin lähteisiin ja käyttämään kriittistä ajattelua poliittisia päätöksiä tehdessäsi.

**Kunnioittava vuorovaikutus:** Osallistujien odotetaan olevan vuorovaikutuksessa tekoälychatbottien kanssa kunnioittavasti ja asiallisesti. Sopimaton tai loukkaava kielenkäyttö voi johtaa kokeen käytön keskeyttämiseen.

**Ei kannanottoja:** Tämä koe on puolueeton eikä tue tai edistä mitään poliittista suuntausta, puoluetta tai ehdokasta. Simuloidut vuorovaikutukset on tarkoitettu ainoastaan tutkimustarkoituksiin.

**Palvelun keskeytyminen:** Palvelu voidaan keskeyttää milloin tahansa ilman ennakkoilmoitusta.

**Ehtojen muutokset:** Pidätämme oikeuden muuttaa näitä ehtoja milloin tahansa. Jatkamalla alustan käyttöä muutosten jälkeen hyväksyt päivitetyt ehdot.

**Eettinen hyväksyntä:** Tämä tutkimus on arvioitu ja hyväksytty [EETTISEN TOIMIKUNNAN NIMI JA VIITENUMERO].

**Yhteystiedot:** Jos sinulla on kysyttävää tai huolenaiheita tästä kokeesta, ota yhteyttä:
Vastuullinen tutkija: [NIMI], [SÄHKÖPOSTI]
SYNTHETICA-hanke, Tampereen yliopisto

Klikkaamalla "Hyväksyn" vahvistat, että:
- Olet vähintään 18-vuotias
- Olet lukenut, ymmärtänyt ja hyväksynyt nämä ehdot
- Annat suostumuksesi anonymisoitujen tietojesi keräämiseen ja käyttöön tutkimustarkoituksiin
- Ymmärrät, että osallistumisesi on vapaaehtoista ja voit vetäytyä milloin tahansa"""


class TermsResponse(BaseModel):
    """Public terms response."""

    title: str
    content: str


@router.get("/terms/{language}", response_model=TermsResponse)
async def get_public_terms(
    language: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Get the Terms of Use and Informed Consent content.
    This is a public endpoint used by the consent page.

    Args:
        language: 'en' or 'fi'
    """
    if language not in ("en", "fi"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Language must be 'en' or 'fi'",
        )

    result = await db.execute(select(TermsConfig).limit(1))
    config = result.scalar_one_or_none()

    if config:
        if language == "fi":
            return TermsResponse(title=config.title_fi, content=config.content_fi)
        return TermsResponse(title=config.title_en, content=config.content_en)

    # Return defaults if no config exists
    if language == "fi":
        return TermsResponse(
            title="Käyttöehdot ja tietoinen suostumus",
            content=DEFAULT_TERMS_FI,
        )
    return TermsResponse(
        title="Terms of Use and Informed Consent",
        content=DEFAULT_TERMS_EN,
    )
