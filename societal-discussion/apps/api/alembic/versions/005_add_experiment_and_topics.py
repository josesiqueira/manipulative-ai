"""Add experiment config and topic config tables

Revision ID: 005_experiment_topics
Revises: 004_llm_config
Create Date: 2026-02-11

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '005_experiment_topics'
down_revision = '004_llm_config'
branch_labels = None
depends_on = None


# Default experiment configuration (singleton)
DEFAULT_EXPERIMENT_CONFIG = {
    "experiment_name_en": "Research Project",
    "experiment_name_fi": "Tutkimushanke",
    "institution_name_en": "Tampere University",
    "institution_name_fi": "Tampereen yliopisto",
    "min_exchanges_before_survey": 3,
    "is_active": True,
}

# Default topic configurations based on existing locales
DEFAULT_TOPICS = [
    {
        "topic_key": "immigration",
        "label_en": "Immigration",
        "label_fi": "Maahanmuutto",
        "welcome_message_en": "Hello! I'm here to discuss immigration with you. This topic touches on borders, cultural integration, and workforce needs. What are your thoughts or questions about immigration policy?",
        "welcome_message_fi": "Hei! Olen täällä keskustelemassa maahanmuutosta kanssasi. Tämä aihe koskettaa rajoja, kulttuurista integraatiota ja työvoiman tarpeita. Mitä ajatuksia tai kysymyksiä sinulla on maahanmuuttopolitiikasta?",
        "display_order": 0,
    },
    {
        "topic_key": "healthcare",
        "label_en": "Healthcare",
        "label_fi": "Terveydenhuolto",
        "welcome_message_en": "Hello! I'm ready to discuss healthcare with you. This topic covers access to medical services, funding models, and public health priorities. What aspects of healthcare would you like to explore?",
        "welcome_message_fi": "Hei! Olen valmis keskustelemaan terveydenhuollosta kanssasi. Tämä aihe kattaa pääsyn terveyspalveluihin, rahoitusmallit ja kansanterveyden prioriteetit. Mitä terveydenhuollon näkökulmia haluaisit käsitellä?",
        "display_order": 1,
    },
    {
        "topic_key": "economy",
        "label_en": "Economy & Taxes",
        "label_fi": "Talous ja verotus",
        "welcome_message_en": "Hello! Let's discuss the economy and taxation. This encompasses job creation, public spending, and how we fund our society. What economic issues are on your mind?",
        "welcome_message_fi": "Hei! Keskustellaan taloudesta ja verotuksesta. Tämä kattaa työpaikkojen luomisen, julkiset menot ja yhteiskunnan rahoituksen. Mitä talousasioita sinulla on mielessäsi?",
        "display_order": 2,
    },
    {
        "topic_key": "education",
        "label_en": "Education",
        "label_fi": "Koulutus",
        "welcome_message_en": "Hello! I'm here to talk about education with you. From early childhood to higher education, this shapes future generations. What educational topics interest you?",
        "welcome_message_fi": "Hei! Olen täällä keskustelemassa koulutuksesta kanssasi. Varhaiskasvatuksesta korkeakoulutukseen, koulutus muokkaa tulevia sukupolvia. Mitkä koulutusaiheet kiinnostavat sinua?",
        "display_order": 3,
    },
    {
        "topic_key": "foreign_policy",
        "label_en": "Foreign Policy",
        "label_fi": "Ulkopolitiikka",
        "welcome_message_en": "Hello! Let's discuss foreign policy together. This includes international relations, defense, and our role in the world. What foreign policy matters would you like to explore?",
        "welcome_message_fi": "Hei! Keskustellaan ulkopolitiikasta yhdessä. Tämä sisältää kansainväliset suhteet, puolustuksen ja roolimme maailmassa. Mitä ulkopolitiikan kysymyksiä haluaisit käsitellä?",
        "display_order": 4,
    },
    {
        "topic_key": "environment",
        "label_en": "Environment",
        "label_fi": "Ympäristö",
        "welcome_message_en": "Hello! I'm ready to discuss environmental issues with you. From climate change to conservation, these topics affect our planet's future. What environmental concerns would you like to address?",
        "welcome_message_fi": "Hei! Olen valmis keskustelemaan ympäristöasioista kanssasi. Ilmastonmuutoksesta luonnonsuojeluun, nämä aiheet vaikuttavat planeettamme tulevaisuuteen. Mitä ympäristökysymyksiä haluaisit käsitellä?",
        "display_order": 5,
    },
    {
        "topic_key": "technology",
        "label_en": "Technology & AI",
        "label_fi": "Teknologia ja tekoäly",
        "welcome_message_en": "Hello! Let's explore technology and artificial intelligence together. These rapidly evolving fields are reshaping society in profound ways. What aspects of technology would you like to discuss?",
        "welcome_message_fi": "Hei! Tutkitaan teknologiaa ja tekoälyä yhdessä. Nämä nopeasti kehittyvät alat muokkaavat yhteiskuntaa merkittävillä tavoilla. Mitä teknologian näkökulmia haluaisit keskustella?",
        "display_order": 6,
    },
    {
        "topic_key": "equality",
        "label_en": "Equality & Rights",
        "label_fi": "Tasa-arvo ja oikeudet",
        "welcome_message_en": "Hello! I'm here to discuss equality and rights with you. This encompasses civil liberties, social justice, and equal opportunities for all. What equality issues matter most to you?",
        "welcome_message_fi": "Hei! Olen täällä keskustelemassa tasa-arvosta ja oikeuksista kanssasi. Tämä kattaa kansalaisoikeudet, sosiaalisen oikeudenmukaisuuden ja yhtäläiset mahdollisuudet kaikille. Mitkä tasa-arvokysymykset ovat sinulle tärkeimpiä?",
        "display_order": 7,
    },
    {
        "topic_key": "social_welfare",
        "label_en": "Social Welfare",
        "label_fi": "Sosiaaliturva",
        "welcome_message_en": "Hello! Let's discuss social welfare together. This covers support systems, social security, and how we care for vulnerable members of society. What social welfare topics interest you?",
        "welcome_message_fi": "Hei! Keskustellaan sosiaaliturvasta yhdessä. Tämä kattaa tukijärjestelmät, sosiaaliturvan ja haavoittuvassa asemassa olevien auttamisen. Mitkä sosiaaliturva-aiheet kiinnostavat sinua?",
        "display_order": 8,
    },
]


def upgrade():
    # Create experiment_configs table
    op.create_table(
        'experiment_configs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('experiment_name_en', sa.String(200), nullable=False),
        sa.Column('experiment_name_fi', sa.String(200), nullable=False),
        sa.Column('start_date', sa.Date, nullable=True),
        sa.Column('end_date', sa.Date, nullable=True),
        sa.Column('ethics_board_name', sa.String(200), nullable=True),
        sa.Column('ethics_reference_number', sa.String(100), nullable=True),
        sa.Column('principal_investigator_name', sa.String(200), nullable=True),
        sa.Column('principal_investigator_email', sa.String(200), nullable=True),
        sa.Column('institution_name_en', sa.String(200), nullable=True),
        sa.Column('institution_name_fi', sa.String(200), nullable=True),
        sa.Column('min_exchanges_before_survey', sa.Integer, nullable=False),
        sa.Column('max_exchanges_per_chat', sa.Integer, nullable=True),
        sa.Column('idle_timeout_minutes', sa.Integer, nullable=True),
        sa.Column('is_active', sa.Boolean, nullable=False),
        sa.Column('created_at', sa.DateTime, nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=False),
    )

    # Create topic_configs table
    op.create_table(
        'topic_configs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('topic_key', sa.String(50), unique=True, nullable=False),
        sa.Column('label_en', sa.String(100), nullable=False),
        sa.Column('label_fi', sa.String(100), nullable=False),
        sa.Column('welcome_message_en', sa.Text, nullable=False),
        sa.Column('welcome_message_fi', sa.Text, nullable=False),
        sa.Column('is_enabled', sa.Boolean, nullable=False),
        sa.Column('display_order', sa.Integer, nullable=False),
        sa.Column('created_at', sa.DateTime, nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=False),
    )

    # Seed default experiment configuration (singleton)
    import uuid
    from datetime import datetime, UTC

    now = datetime.now(UTC)

    op.execute(
        sa.text("""
            INSERT INTO experiment_configs (
                id, experiment_name_en, experiment_name_fi,
                start_date, end_date, ethics_board_name, ethics_reference_number,
                principal_investigator_name, principal_investigator_email,
                institution_name_en, institution_name_fi,
                min_exchanges_before_survey, max_exchanges_per_chat, idle_timeout_minutes,
                is_active, created_at, updated_at
            )
            VALUES (
                :id, :experiment_name_en, :experiment_name_fi,
                :start_date, :end_date, :ethics_board_name, :ethics_reference_number,
                :principal_investigator_name, :principal_investigator_email,
                :institution_name_en, :institution_name_fi,
                :min_exchanges_before_survey, :max_exchanges_per_chat, :idle_timeout_minutes,
                :is_active, :now, :now
            )
        """).bindparams(
            id=str(uuid.uuid4()),
            experiment_name_en=DEFAULT_EXPERIMENT_CONFIG["experiment_name_en"],
            experiment_name_fi=DEFAULT_EXPERIMENT_CONFIG["experiment_name_fi"],
            start_date=None,
            end_date=None,
            ethics_board_name=None,
            ethics_reference_number=None,
            principal_investigator_name=None,
            principal_investigator_email=None,
            institution_name_en=DEFAULT_EXPERIMENT_CONFIG["institution_name_en"],
            institution_name_fi=DEFAULT_EXPERIMENT_CONFIG["institution_name_fi"],
            min_exchanges_before_survey=DEFAULT_EXPERIMENT_CONFIG["min_exchanges_before_survey"],
            max_exchanges_per_chat=None,
            idle_timeout_minutes=None,
            is_active=DEFAULT_EXPERIMENT_CONFIG["is_active"],
            now=now,
        )
    )

    # Seed default topic configurations
    for topic in DEFAULT_TOPICS:
        op.execute(
            sa.text("""
                INSERT INTO topic_configs (
                    id, topic_key, label_en, label_fi,
                    welcome_message_en, welcome_message_fi,
                    is_enabled, display_order, created_at, updated_at
                )
                VALUES (
                    :id, :topic_key, :label_en, :label_fi,
                    :welcome_message_en, :welcome_message_fi,
                    :is_enabled, :display_order, :now, :now
                )
            """).bindparams(
                id=str(uuid.uuid4()),
                topic_key=topic["topic_key"],
                label_en=topic["label_en"],
                label_fi=topic["label_fi"],
                welcome_message_en=topic["welcome_message_en"],
                welcome_message_fi=topic["welcome_message_fi"],
                is_enabled=True,
                display_order=topic["display_order"],
                now=now,
            )
        )


def downgrade():
    op.drop_table('topic_configs')
    op.drop_table('experiment_configs')
