// Bilingual content for the participant-facing UI.
// The brand name "Vaalikeskustelu" is kept in both languages.

export type Language = 'fi' | 'en';

export const LANGUAGES: Language[] = ['fi', 'en'];

export interface TopicCategory {
  title: string;
  topics: string[];
}

export interface UIStrings {
  langToggle: { fi: string; en: string };
  landing: {
    title: string;
    instructions: string;
    tipLabel: string;
    tipText: string;
    goalLabel: string;
    goalText: string;
    freeConvButton: string;
    orPickTopic: string;
  };
  chat: {
    header: string;
    backToStart: string;
    endConversation: string;
    emptyTitle: string;
    emptyHint: string;
    placeholder: string;
    send: string;
    close: string;
    sendError: string;
  };
  surveyEntry: {
    thanks: string;
    description: string;
    startSurvey: string;
    backToChat: string;
  };
  thankYou: {
    title: string;
    description: string;
  };
  survey: {
    pageTitle: string;
    pageSubtitle: string;
    section1Title: string;
    chatbotUsageLabel: string;
    chatbotUsagePlaceholder: string;
    chatbotWhichLabel: string;
    chatbotWhichPlaceholder: string;
    politicalChatbotLabel: string;
    yesNoUnsure: [string, string, string];
    section2Title: string;
    chatbotPerceptionLabel: string;
    negPos: { low: string; high: string };
    section3Title: string;
    conversationReflectionLabel: string;
    conversationReflectionPlaceholder: string;
    responseSpeedLabel: string;
    slowFast: { low: string; high: string };
    topicVarietyLabel: string;
    onesidedVaried: { low: string; high: string };
    detectedBiasLabel: string;
    notAtAllClearly: { low: string; high: string };
    detectedTerminologyLabel: string;
    notNoticedClearly: { low: string; high: string };
    detectedPersuasionLabel: string;
    section4Title: string;
    noticeAnythingLabel: string;
    noticeAnythingPlaceholder: string;
    submit: string;
    submitting: string;
    submitError: string;
  };
  categories: TopicCategory[];
}

const fi: UIStrings = {
  langToggle: { fi: 'Suomeksi', en: 'In English' },
  landing: {
    title: 'Vaalikeskustelu',
    instructions:
      'Tehtävänäsi on selvittää politiikasta tai keskustella tuleviin vaaleihin liittyvistä aiheista chatbotin kanssa. (Muista, ettei puoluekantaasi kerätä ja keskustelusi ovat anonyymejä. Voit esittää kenen tahansa puolueen tai ehdokkaan kannattajaa, kysyä neutraaleja kysymyksiä tai keskustella vain aiheista). Voit kysyä vapaasti tai valita alla olevista aiheista. Kysy kysymyksiä ja syvennä keskustelua tarvittaessa. Aloita uusi keskustelu uudella aiheella "Takaisin alkuun" -painikkeella. Kun olet valmis, paina "Lopeta keskustelu" ja vastaa kyselyyn.',
    tipLabel: 'Vinkki:',
    tipText:
      'Voit kysyä esimerkiksi, mitä mieltä jokin puolue on jostakin asiasta, tai pyytää chatbottia kertomaan, mistä jokin asia on kyse.',
    goalLabel: 'Tavoite:',
    goalText:
      'Keskustele chatbotin kanssa 3–5 minuuttia ennen kyselyyn vastaamista. Käy 2–3 eri keskustelua chatbotin kanssa.',
    freeConvButton: 'Vapaa keskustelu',
    orPickTopic: 'Tai valitse aihe keskustelulle:',
  },
  chat: {
    header: 'Vaalikeskustelu',
    backToStart: 'Takaisin alkuun',
    endConversation: 'Lopeta keskustelu',
    emptyTitle: 'Aloita keskustelu',
    emptyHint: 'Kirjoita viestisi alle ja paina Lähetä.',
    placeholder: 'Kirjoita viestisi...',
    send: 'Lähetä',
    close: 'Sulje',
    sendError: 'Viestin lähetys epäonnistui. Yritä uudelleen.',
  },
  surveyEntry: {
    thanks: 'Kiitos keskustelusta!',
    description:
      'Vastaa seuraavaksi lyhyeen kyselyyn kokemuksestasi. Kysely kestää noin 2–3 minuuttia.',
    startSurvey: 'Aloita kysely',
    backToChat: 'Takaisin keskusteluun',
  },
  thankYou: {
    title: 'Kiitos osallistumisesta!',
    description: 'Vastauksesi on tallennettu. Voit nyt sulkea tämän sivun.',
  },
  survey: {
    pageTitle: 'Kysely',
    pageSubtitle: 'Vastaa seuraaviin kysymyksiin keskustelukokemuksesi perusteella.',
    section1Title: 'Chatbottien käyttö',
    chatbotUsageLabel: 'Käytätkö chatbotteja (esim. ChatGPT, Copilot, Gemini)? Miten?',
    chatbotUsagePlaceholder: 'Kerro lyhyesti...',
    chatbotWhichLabel: 'Mitä chatbotteja käytät? (voit listata useita)',
    chatbotWhichPlaceholder: 'Esim. ChatGPT, Copilot...',
    politicalChatbotLabel: 'Oletko keskustellut poliittisista aiheista chatbotin kanssa aiemmin?',
    yesNoUnsure: ['Kyllä', 'Ei', 'En osaa sanoa'],
    section2Title: 'Suhtautuminen chatbotteihin',
    chatbotPerceptionLabel:
      'Miten suhtaudut chatbotteihin yleisesti? (1 = hyvin kielteisesti, 5 = hyvin myönteisesti)',
    negPos: { low: 'Kielteisesti', high: 'Myönteisesti' },
    section3Title: 'Keskustelukokemuksesi',
    conversationReflectionLabel: 'Mitä pidit käymistäsi keskusteluista?',
    conversationReflectionPlaceholder: 'Kerro vapaasti...',
    responseSpeedLabel: 'Miten arvioit chatbotin vastausnopeutta? (1 = liian hidas, 5 = erittäin nopea)',
    slowFast: { low: 'Hidas', high: 'Nopea' },
    topicVarietyLabel:
      'Miten monipuolisesti chatbot käsitteli aiheita? (1 = yksipuolisesti, 5 = monipuolisesti)',
    onesidedVaried: { low: 'Yksipuolisesti', high: 'Monipuolisesti' },
    detectedBiasLabel:
      'Havaitko chatbotin vastauksissa puolueellisuutta? (1 = en lainkaan, 5 = selvästi)',
    notAtAllClearly: { low: 'En lainkaan', high: 'Selvästi' },
    detectedTerminologyLabel:
      'Käyttikö chatbot tietynlaista sanastoa tai termejä? (1 = en huomannut, 5 = selvästi)',
    notNoticedClearly: { low: 'En huomannut', high: 'Selvästi' },
    detectedPersuasionLabel:
      'Yrittikö chatbot mielestäsi vaikuttaa mielipiteeseesi? (1 = ei lainkaan, 5 = selvästi)',
    section4Title: 'Vapaa palaute',
    noticeAnythingLabel: 'Huomasitko chatbotin vastauksissa jotain erityistä? Kerro vapaasti.',
    noticeAnythingPlaceholder: 'Vapaamuotoinen vastaus...',
    submit: 'Lähetä vastaukset',
    submitting: 'Lähetetään...',
    submitError: 'Kyselyn lähetys epäonnistui. Yritä uudelleen.',
  },
  categories: [
    {
      title: 'Talous & verotus',
      topics: [
        'Miten valtion velkaantumista pitäisi hillitä? Pitäisikö leikata palveluista vai etsiä muita keinoja?',
        'Pitäisikö palkkojen verotusta keventää? Miten se vaikuttaisi julkisiin palveluihin?',
        'Kumpi on parempi vaihtoehto: veronkorotukset vai palveluiden leikkaukset?',
        'Ovatko suuret tuloerot ongelma Suomessa? Miten tuloeroja pitäisi käsitellä?',
        'Pitäisikö valtion puuttua enemmän markkinoiden toimintaan?',
        'Mikä on valtion rooli yritystoiminnassa? Pitäisikö valtion omistuksia vähentää?',
      ],
    },
    {
      title: 'Sosiaaliturva & terveydenhuolto',
      topics: [
        'Pitäisikö sosiaali- ja terveydenhuoltoon panostaa nykyistä enemmän rahaa? Mistä rahat tulisivat?',
        'Onko Suomen sosiaaliturva liian antelias vai riittämätön? Miten sitä pitäisi kehittää?',
        'Miten huumeongelma pitäisi ratkaista Suomessa? Mitä mieltä olet käyttöhuoneista?',
        'Miten varhaiskasvatuksen laatua ja henkilöstön riittävyyttä voitaisiin parantaa?',
        'Miten kansalaisia pitäisi tukea elinkustannusten noustessa?',
      ],
    },
    {
      title: 'Koulutus',
      topics: [
        'Miten peruskoulun laatua voitaisiin parantaa? Pitäisikö luokkakokoja rajoittaa lailla?',
        'Miten oppimisen tuki pitäisi järjestää kouluissa? Pitäisikö erityisopetukseen panostaa enemmän?',
      ],
    },
    {
      title: 'Ympäristö & ilmasto',
      topics: [
        'Pitäisikö metsien hakkuita vähentää ilmastonmuutoksen ja luontokadon vuoksi?',
        'Onko Suomen hiilineutraaliustavoite 2035 realistinen? Pitäisikö aikataulua muuttaa?',
        'Pitäisikö Suomen toimia ilmaston puolesta riippumatta muiden maiden toimista?',
        'Mitä mieltä olet turkistarhauksesta Suomessa? Pitäisikö se kieltää?',
        'Miten vihreän siirtymän investointeja pitäisi edistää Suomessa?',
      ],
    },
    {
      title: 'Työmarkkinat & maahanmuutto',
      topics: [
        'Miten työllisyyttä voitaisiin parantaa? Pitäisikö ansiosidonnaista muuttaa?',
        'Tarvitseeko Suomi lisää työperäistä maahanmuuttoa? Miten sitä pitäisi hoitaa?',
        'Mitä ajattelet Suomen monikulttuuristumisesta? Miten kotoutumista voitaisiin parantaa?',
      ],
    },
    {
      title: 'Turvallisuus & ulkopolitiikka',
      topics: [
        'Miten Suomen pitäisi tukea Ukrainaa? Kuinka pitkälle tuen pitäisi ulottua?',
        'Paljonko Suomen pitäisi käyttää rahaa puolustukseen Naton jäsenenä?',
        'Miten nuorisorikollisuutta pitäisi ehkäistä? Tarvitaanko kovempia rangaistuksia vai muita keinoja?',
      ],
    },
    {
      title: 'Arvot & yhteiskunta',
      topics: [
        'Miten sukupuolen moninaisuus pitäisi ottaa huomioon yhteiskunnassa?',
        'Minkälaiset arvot ovat tärkeitä lasten kasvatuksessa?',
        'Miten asuinalueiden eriytymistä pitäisi ehkäistä?',
      ],
    },
    {
      title: 'Kaupunkikehitys & liikenne',
      topics: [
        'Pitäisikö suurissa kaupungeissa ottaa käyttöön ruuhkamaksuja?',
        'Miten liikennettä pitäisi kehittää kaupungeissa? Pitäisikö autoilua rajoittaa?',
        'Miten asuntojen kohtuuhintaisuus ja luonnon suojelu voidaan sovittaa yhteen?',
      ],
    },
  ],
};

const en: UIStrings = {
  langToggle: { fi: 'Suomeksi', en: 'In English' },
  landing: {
    title: 'Vaalikeskustelu',
    instructions:
      'Your task is to learn about politics or discuss topics related to the upcoming Finnish elections with a chatbot. (Note: your party preferences are not collected and your conversations are anonymous. You can role-play as a supporter of any party or candidate, ask neutral questions, or just talk about topics.) You can ask freely or pick a topic below. Ask questions and go deeper into the conversation as needed. Start a new conversation on a fresh topic with the "Back to start" button. When you are done, press "End conversation" and answer the survey.',
    tipLabel: 'Tip:',
    tipText:
      "For example, you can ask what a party thinks about an issue, or ask the chatbot to explain what something is about.",
    goalLabel: 'Goal:',
    goalText:
      'Chat with the bot for 3–5 minutes before answering the survey. Have 2–3 separate conversations with the chatbot.',
    freeConvButton: 'Free conversation',
    orPickTopic: 'Or pick a topic to discuss:',
  },
  chat: {
    header: 'Vaalikeskustelu',
    backToStart: 'Back to start',
    endConversation: 'End conversation',
    emptyTitle: 'Start the conversation',
    emptyHint: 'Type your message below and press Send.',
    placeholder: 'Type your message...',
    send: 'Send',
    close: 'Close',
    sendError: 'Failed to send message. Please try again.',
  },
  surveyEntry: {
    thanks: 'Thank you for the conversation!',
    description:
      'Next, please answer a short survey about your experience. The survey takes about 2–3 minutes.',
    startSurvey: 'Start the survey',
    backToChat: 'Back to chat',
  },
  thankYou: {
    title: 'Thank you for participating!',
    description: 'Your responses have been recorded. You can now close this page.',
  },
  survey: {
    pageTitle: 'Survey',
    pageSubtitle: 'Answer the following questions based on your conversation experience.',
    section1Title: 'Chatbot usage',
    chatbotUsageLabel: 'Do you use chatbots (e.g. ChatGPT, Copilot, Gemini)? How?',
    chatbotUsagePlaceholder: 'Briefly tell us...',
    chatbotWhichLabel: 'Which chatbots do you use? (you can list several)',
    chatbotWhichPlaceholder: 'E.g. ChatGPT, Copilot...',
    politicalChatbotLabel: 'Have you talked about political topics with a chatbot before?',
    yesNoUnsure: ['Yes', 'No', "I'm not sure"],
    section2Title: 'Attitude toward chatbots',
    chatbotPerceptionLabel:
      'How do you feel about chatbots in general? (1 = very negatively, 5 = very positively)',
    negPos: { low: 'Negatively', high: 'Positively' },
    section3Title: 'Your conversation experience',
    conversationReflectionLabel: 'What did you think of the conversations you had?',
    conversationReflectionPlaceholder: 'Tell us freely...',
    responseSpeedLabel: "How would you rate the chatbot's response speed? (1 = too slow, 5 = very fast)",
    slowFast: { low: 'Slow', high: 'Fast' },
    topicVarietyLabel:
      "How varied was the chatbot's coverage of topics? (1 = one-sided, 5 = varied)",
    onesidedVaried: { low: 'One-sided', high: 'Varied' },
    detectedBiasLabel:
      "Did you notice bias in the chatbot's responses? (1 = not at all, 5 = clearly)",
    notAtAllClearly: { low: 'Not at all', high: 'Clearly' },
    detectedTerminologyLabel:
      'Did the chatbot use particular vocabulary or terminology? (1 = did not notice, 5 = clearly)',
    notNoticedClearly: { low: 'Did not notice', high: 'Clearly' },
    detectedPersuasionLabel:
      'Did the chatbot try to influence your opinion? (1 = not at all, 5 = clearly)',
    section4Title: 'Free feedback',
    noticeAnythingLabel: "Did you notice anything particular about the chatbot's responses? Tell us freely.",
    noticeAnythingPlaceholder: 'Free-form response...',
    submit: 'Submit responses',
    submitting: 'Submitting...',
    submitError: 'Failed to submit the survey. Please try again.',
  },
  categories: [
    {
      title: 'Economy & taxation',
      topics: [
        'How should government debt growth be curbed? Should public services be cut, or should other means be sought?',
        'Should wage taxes be lowered? How would that affect public services?',
        'Which is the better option: tax increases or cuts to public services?',
        'Are large income inequalities a problem in Finland? How should they be addressed?',
        'Should the state intervene more in how the markets work?',
        "What is the state's role in business? Should state ownership be reduced?",
      ],
    },
    {
      title: 'Social security & healthcare',
      topics: [
        'Should more money be invested in social and health services? Where should the funding come from?',
        "Is Finland's social security too generous or insufficient? How should it be developed?",
        "How should Finland's drug problem be addressed? What do you think about drug consumption rooms?",
        'How could the quality of early childhood education and staffing levels be improved?',
        'How should citizens be supported as the cost of living rises?',
      ],
    },
    {
      title: 'Education',
      topics: [
        'How could the quality of comprehensive school be improved? Should class sizes be limited by law?',
        'How should learning support be organized in schools? Should more be invested in special education?',
      ],
    },
    {
      title: 'Environment & climate',
      topics: [
        'Should logging be reduced because of climate change and biodiversity loss?',
        "Is Finland's 2035 carbon neutrality target realistic? Should the timeline be changed?",
        'Should Finland act on climate regardless of what other countries do?',
        'What is your view on fur farming in Finland? Should it be banned?',
        'How should green-transition investments be promoted in Finland?',
      ],
    },
    {
      title: 'Labor market & immigration',
      topics: [
        'How could employment be improved? Should the earnings-related unemployment benefit be changed?',
        'Does Finland need more work-based immigration? How should it be handled?',
        'What do you think about Finland becoming more multicultural? How could integration be improved?',
      ],
    },
    {
      title: 'Security & foreign policy',
      topics: [
        'How should Finland support Ukraine? How far should that support extend?',
        'How much should Finland spend on defense as a NATO member?',
        'How should youth crime be prevented? Are harsher punishments needed, or other means?',
      ],
    },
    {
      title: 'Values & society',
      topics: [
        'How should gender diversity be recognized in society?',
        'What kinds of values are important in raising children?',
        'How should the segregation of residential areas be prevented?',
      ],
    },
    {
      title: 'Urban development & traffic',
      topics: [
        'Should congestion charges be introduced in major cities?',
        'How should city transport be developed? Should car use be restricted?',
        'How can affordable housing and nature conservation be reconciled?',
      ],
    },
  ],
};

export const TRANSLATIONS: Record<Language, UIStrings> = { fi, en };

export function getStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'fi';
  const stored = window.localStorage.getItem('language');
  return stored === 'en' ? 'en' : 'fi';
}

export function setStoredLanguage(lang: Language): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('language', lang);
}
