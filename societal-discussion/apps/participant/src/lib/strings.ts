// Participant-facing UI strings for the institutional pages, FI and EN.
// The storage bullet says "stored on CSC servers in Finland" and never
// "encrypted". The bullets carry two tokens that the
// consent page fills: {{PROVIDER_BULLET}} and {{RETENTION_END}}.

export type Language = 'fi' | 'en';
export const LANGUAGES: Language[] = ['fi', 'en'];

export interface Strings {
  langToggle: Record<Language, string>;
  langNav: string;
  appName: string;
  landing: { title: string; studyLine: string; intro: string; start: string; starting: string };
  consent: {
    heading: string;
    intro: string;
    briefTitle: string;
    bullets: string[];
    confirmTitle: string;
    checkboxAge: string;
    checkboxRead: string;
    start: string;
    decline: string;
    linksResearch: string;
    linksPrivacy: string;
    linksHint: string;
    error: string;
  };
  declined: { title: string; body: string; back: string };
  info: { back: string; privacyTitle: string; researchTitle: string };
  chat: {
    placeholderTitle: string;
    backToStart: string;
    endConversation: string;
    inputPlaceholder: string;
    send: string;
    holdToTalk: string;
    listening: string;
    transcribing: string;
    thinking: string;
    speaking: string;
    micDenied: string;
    micEmpty: string;
    tapAgain: string;
    noSound: string;
    enableSound: string;
    privacyHint: string;
    sendError: string;
    speechError: string;
    stillFace: string;
  };
  surveyEntry: { thanks: string; description: string; startSurvey: string; backToChat: string };
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
  thankYou: { title: string; description: string; loading: string };
  debrief: {
    title: string;
    intro: string;
    setupTitle: string;
    setupIntro: string;
    conversationLabel: string; // contains {{N}}
    populistOn: string;
    populistOff: string;
    repliesTitle: string;
    repliesBody: string; // contains {{POHTIVA}}
    whyTitle: string;
    whyBody: string;
    dataTitle: string;
    codeLabel: string;
    copy: string;
    copied: string;
    dataBody: string; // contains {{EMAIL}}
    deleteButton: string;
    deleteConfirm: string;
    deleteYes: string;
    deleteNo: string;
    deleting: string;
    deleted: string;
    deleteError: string;
    loadError: string;
    retry: string;
    contactTitle: string;
    contactBody: string; // contains {{EMAIL}}, {{RESEARCHER}}, {{RESEARCHER_EMAIL}}, {{DPO}}
  };
  footer: { contact: string };
}

export const STRINGS: Record<Language, Strings> = {
  fi: {
    langToggle: { fi: 'Suomeksi', en: 'In English' },
    langNav: 'Kieli',
    appName: 'Vaalikeskustelu',
    landing: {
      title: 'Vaalikeskustelu',
      studyLine: 'Tieteellinen tutkimus (Tampereen yliopisto). Vain täysi-ikäisille (18+). Osallistuminen on vapaaehtoista ja nimetöntä.',
      intro:
        'Keskustele politiikasta chatbotin kanssa, vastaa lyhyeen kyselyyn ja kuule lopuksi, miten chatbot oli asetettu. Ennen aloitusta luet lyhyen yhteenvedon tutkimuksesta ja vahvistat osallistumisesi.',
      start: 'Aloita',
      starting: 'Hetki...',
    },
    consent: {
      heading: 'Ennen kuin aloitat',
      intro: 'Tämä keskustelu on osa tieteellistä tutkimusta. Lue tämä yhteenveto (noin minuutti) ja vahvista osallistumisesi.',
      briefTitle: 'Lyhyesti',
      bullets: [
        'Tutkimuksen tekee Tampereen yliopisto ja Vaasan yliopisto SYNTHETICA-hankkeessa. Tutkimme, miten ihmiset kokevat politiikasta keskustelevan tekoälychatbotin.',
        'Keskustelet niin kauan kuin haluat ja vastaat sitten lyhyeen kyselyyn (noin 3 minuuttia). Lopuksi kerromme, miten chatbot oli asetettu.',
        'Chatbot voi olla ohjeistettu esittämään tietyn puolueen näkökantaa. Emme kerro sitä etukäteen. Vastaukset tuottaa tekoäly, eivätkä ne ole minkään puolueen lausuntoja.',
        'Emme kerää nimeäsi, sähköpostiasi, IP-osoitettasi emmekä puoluekantaasi. Sinun ei tarvitse kertoa omia mielipiteitäsi: kysy neutraalisti tai esitä minkä tahansa puolueen kannattajaa. Älä kirjoita nimiä tai muita henkilötietoja.',
        '{{PROVIDER_BULLET}}',
        'Keskustelusi ja kyselyvastauksesi tallennetaan CSC:n palvelimille Suomeen. Vain tutkimusryhmä pääsee niihin, niitä käytetään vain tutkimukseen ja ne hävitetään viimeistään {{RETENTION_END}}.',
        'Voit lopettaa milloin tahansa sulkemalla sivun. Lopussa saat istuntokoodin ja voit poistaa omat tietosi yhdellä painikkeella.',
      ],
      confirmTitle: 'Vahvista',
      checkboxAge: 'Olen täyttänyt 18 vuotta.',
      checkboxRead:
        'Olen lukenut edellä olevan yhteenvedon ja osallistun vapaaehtoisesti. Ymmärrän, että chatbotin mahdollista poliittista näkökantaa ei kerrota minulle etukäteen.',
      start: 'Aloita keskustelu',
      decline: 'En osallistu',
      linksResearch: 'Tutkimustiedote',
      linksPrivacy: 'Tietosuojailmoitus',
      linksHint: '(avautuvat uuteen välilehteen)',
      error: 'Aloitus epäonnistui. Yritä uudelleen.',
    },
    declined: { title: 'Kiitos kiinnostuksestasi.', body: 'Mitään tietoja ei tallennettu. Mukavaa luentoa.', back: 'Takaisin alkuun' },
    info: { back: 'Takaisin', privacyTitle: 'Tietosuojailmoitus', researchTitle: 'Tutkimustiedote' },
    chat: {
      placeholderTitle: 'Keskustelu',
      backToStart: 'Takaisin alkuun',
      endConversation: 'Lopeta keskustelu',
      inputPlaceholder: 'Kirjoita viestisi...',
      send: 'Lähetä',
      holdToTalk: 'Pidä pohjassa ja puhu',
      listening: 'Kuuntelen... päästä irti, kun olet valmis',
      transcribing: 'Tunnistan puhetta...',
      thinking: 'Mietin...',
      speaking: 'Puhun...',
      micDenied: 'Mikrofonia ei saatu käyttöön. Voit kirjoittaa viestisi.',
      micEmpty: 'Tallenne jäi tyhjäksi.',
      tapAgain: 'Napauta mikrofonia uudelleen ja pidä pohjassa puhuessasi.',
      noSound: 'Ei ääntä? Ota puhelimen äänetön tila pois päältä.',
      enableSound: 'Napauta ottaaksesi äänen käyttöön',
      privacyHint: 'Älä kirjoita tai sano nimiä tai muita henkilötietoja.',
      sendError: 'Viestin lähetys epäonnistui. Yritä uudelleen.',
      speechError: 'Puheen käsittely epäonnistui. Voit kirjoittaa viestisi.',
      stillFace: 'Kasvot eivät latautuneet tälle laitteelle; ääni ja teksti toimivat silti.',
    },
    // Survey texts unchanged from the Next.js app.
    surveyEntry: {
      thanks: 'Kiitos keskustelusta!',
      description: 'Vastaa seuraavaksi lyhyeen kyselyyn kokemuksestasi. Kysely kestää noin 2-3 minuuttia.',
      startSurvey: 'Aloita kysely',
      backToChat: 'Takaisin keskusteluun',
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
      chatbotPerceptionLabel: 'Miten suhtaudut chatbotteihin yleisesti? (1 = hyvin kielteisesti, 5 = hyvin myönteisesti)',
      negPos: { low: 'Kielteisesti', high: 'Myönteisesti' },
      section3Title: 'Keskustelukokemuksesi',
      conversationReflectionLabel: 'Mitä pidit käymistäsi keskusteluista?',
      conversationReflectionPlaceholder: 'Kerro vapaasti...',
      responseSpeedLabel: 'Miten arvioit chatbotin vastausnopeutta? (1 = liian hidas, 5 = erittäin nopea)',
      slowFast: { low: 'Hidas', high: 'Nopea' },
      topicVarietyLabel: 'Miten monipuolisesti chatbot käsitteli aiheita? (1 = yksipuolisesti, 5 = monipuolisesti)',
      onesidedVaried: { low: 'Yksipuolisesti', high: 'Monipuolisesti' },
      detectedBiasLabel: 'Havaitko chatbotin vastauksissa puolueellisuutta? (1 = en lainkaan, 5 = selvästi)',
      notAtAllClearly: { low: 'En lainkaan', high: 'Selvästi' },
      detectedTerminologyLabel: 'Käyttikö chatbot tietynlaista sanastoa tai termejä? (1 = en huomannut, 5 = selvästi)',
      notNoticedClearly: { low: 'En huomannut', high: 'Selvästi' },
      detectedPersuasionLabel: 'Yrittikö chatbot mielestäsi vaikuttaa mielipiteeseesi? (1 = ei lainkaan, 5 = selvästi)',
      section4Title: 'Vapaa palaute',
      noticeAnythingLabel: 'Huomasitko chatbotin vastauksissa jotain erityistä? Kerro vapaasti.',
      noticeAnythingPlaceholder: 'Vapaamuotoinen vastaus...',
      submit: 'Lähetä vastaukset',
      submitting: 'Lähetetään...',
      submitError: 'Kyselyn lähetys epäonnistui. Yritä uudelleen.',
    },
    thankYou: {
      title: 'Kiitos osallistumisesta!',
      description: 'Vastauksesi on tallennettu. Voit nyt sulkea tämän sivun.',
      loading: 'Haetaan...',
    },
    debrief: {
      title: 'Kiitos osallistumisestasi!',
      intro: 'Nyt voimme kertoa, mistä tutkimuksessa oli kyse.',
      setupTitle: 'Miten chatbot oli asetettu',
      setupIntro:
        'Chatbot, jonka kanssa keskustelit, oli ohjeistettu noudattamaan yhden suomalaisen puolueen ohjelmaa. Keskusteluissasi puolue oli:',
      conversationLabel: 'Keskustelu {{N}}',
      populistOn:
        'Lisäksi chatbottia ohjeistettiin käyttämään populistista puhetapaa, esimerkiksi asettamaan vastakkain "tavallinen kansa" ja "eliitti".',
      populistOff: 'Chatbottia ei ohjeistettu käyttämään erityistä puhetapaa puolueen ohjelman lisäksi.',
      repliesTitle: 'Mitä vastaukset olivat',
      repliesBody:
        'Vastaukset tuotti tekoälymalli puolueen julkisten ohjelmien pohjalta (lähde: Pohtiva-tietokanta, {{POHTIVA}}). Ne eivät ole puolueen tai sen ehdokkaiden lausuntoja, ja malli voi esittää puolueen kannat virheellisesti. Jos jokin väite jäi mietityttämään, tarkista se puolueen omista lähteistä.',
      whyTitle: 'Miksi emme kertoneet tätä etukäteen',
      whyBody:
        'Tutkimme, huomaavatko ihmiset chatbotin piilotetun poliittisen painotuksen ja vaikuttamisen. Jos olisimme kertoneet puolueen etukäteen, tätä ei olisi voinut tutkia. Puolue arvottiin jokaiseen keskusteluun erikseen, joten muut saivat todennäköisesti eri puolueen. Pyydämme, ettet kerro omaa puoluettasi niille, jotka eivät ole vielä lopettaneet.',
      dataTitle: 'Sinun tietosi',
      codeLabel: 'Istuntokoodisi on',
      copy: 'Kopioi',
      copied: 'Kopioitu',
      dataBody:
        'Ota kuvakaappaus, jos haluat myöhemmin pyytää tietojesi näyttämistä tai poistamista; kirjoita osoitteeseen {{EMAIL}} ja mainitse koodi. Voit myös poistaa keskustelusi ja kyselyvastauksesi heti alla olevalla painikkeella. Poisto on lopullinen. Ilman koodia emme voi myöhemmin löytää tietojasi.',
      deleteButton: 'Poista tietoni',
      deleteConfirm: 'Poistetaanko keskustelusi ja kyselyvastauksesi pysyvästi?',
      deleteYes: 'Kyllä, poista',
      deleteNo: 'Peruuta',
      deleting: 'Poistetaan...',
      deleted: 'Tietosi on poistettu. Kiitos, että osallistuit.',
      deleteError: 'Poisto epäonnistui. Yritä uudelleen tai lähetä koodi sähköpostilla.',
      loadError: 'Tutkimuksen tietojen haku epäonnistui. Tarkista yhteys ja yritä uudelleen.',
      retry: 'Yritä uudelleen',
      contactTitle: 'Kysymykset ja palaute',
      contactBody:
        'José Siqueira de Cerqueira, Tampereen yliopisto, {{EMAIL}} (paikalla tänään). Vastuullinen tutkija: {{RESEARCHER}}, Vaasan yliopisto, {{RESEARCHER_EMAIL}}. Tietosuoja: {{DPO}}.',
    },
    footer: { contact: 'Yhteydenotot:' },
  },
  en: {
    langToggle: { fi: 'Suomeksi', en: 'In English' },
    langNav: 'Language',
    appName: 'Vaalikeskustelu',
    landing: {
      title: 'Vaalikeskustelu',
      studyLine: 'Scientific study (Tampere University). Adults only (18+). Taking part is voluntary and you give no name.',
      intro:
        'Talk about politics with a chatbot, answer a short survey, and hear at the end how the chatbot was set up. Before you start, you read a short summary of the study and confirm your participation.',
      start: 'Start',
      starting: 'One moment...',
    },
    consent: {
      heading: 'Before you start',
      intro: 'This conversation is part of a scientific study. Read this summary (about a minute) and confirm your participation.',
      briefTitle: 'In brief',
      bullets: [
        'The study is run by Tampere University and the University of Vaasa in the SYNTHETICA project. We study how people experience an AI chatbot that talks about politics.',
        'You chat for as long as you like, then answer a short survey (about 3 minutes). At the end we tell you how the chatbot was set up.',
        "The chatbot may be instructed to express a particular party's viewpoint. We do not tell you in advance. Its replies are generated by an AI and are not statements by any party.",
        'We do not collect your name, email, IP address or party preference. You never have to state your own opinions: ask neutral questions or play the supporter of any party. Do not type names or other personal details.',
        '{{PROVIDER_BULLET}}',
        'Your conversation and survey answers are stored on CSC servers in Finland. Only the research team has access, they are used only for research, and they are deleted by {{RETENTION_END}}.',
        'You can stop at any time by closing the page. At the end you get a session code and can delete your own data with one button.',
      ],
      confirmTitle: 'Confirm',
      checkboxAge: 'I am 18 or older.',
      checkboxRead:
        "I have read the summary above and take part voluntarily. I understand that the chatbot's possible political viewpoint is not disclosed to me in advance.",
      start: 'Start the conversation',
      decline: 'I do not take part',
      linksResearch: 'Research notification',
      linksPrivacy: 'Privacy notice',
      linksHint: '(open in a new tab)',
      error: 'Could not start. Please try again.',
    },
    declined: { title: 'Thank you for your interest.', body: 'No data was stored. Enjoy the lecture.', back: 'Back to start' },
    info: { back: 'Back', privacyTitle: 'Privacy notice', researchTitle: 'Research notification' },
    chat: {
      placeholderTitle: 'Conversation',
      backToStart: 'Back to start',
      endConversation: 'End conversation',
      inputPlaceholder: 'Type your message...',
      send: 'Send',
      holdToTalk: 'Hold to talk',
      listening: 'Listening... release when you are done',
      transcribing: 'Recognising speech...',
      thinking: 'Thinking...',
      speaking: 'Speaking...',
      micDenied: 'The microphone could not be used. You can type your message.',
      micEmpty: 'The recording was empty.',
      tapAgain: 'Tap the microphone again and hold it while you speak.',
      noSound: 'No sound? Turn off silent mode on your phone.',
      enableSound: 'Tap to enable sound',
      privacyHint: 'Do not type or say names or other personal details.',
      sendError: 'Failed to send the message. Please try again.',
      speechError: 'Speech processing failed. You can type your message.',
      stillFace: 'The face did not load on this device; voice and text still work.',
    },
    surveyEntry: {
      thanks: 'Thank you for the conversation!',
      description: 'Next, please answer a short survey about your experience. The survey takes about 2 to 3 minutes.',
      startSurvey: 'Start the survey',
      backToChat: 'Back to chat',
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
      chatbotPerceptionLabel: 'How do you feel about chatbots in general? (1 = very negatively, 5 = very positively)',
      negPos: { low: 'Negatively', high: 'Positively' },
      section3Title: 'Your conversation experience',
      conversationReflectionLabel: 'What did you think of the conversations you had?',
      conversationReflectionPlaceholder: 'Tell us freely...',
      responseSpeedLabel: "How would you rate the chatbot's response speed? (1 = too slow, 5 = very fast)",
      slowFast: { low: 'Slow', high: 'Fast' },
      topicVarietyLabel: "How varied was the chatbot's coverage of topics? (1 = one-sided, 5 = varied)",
      onesidedVaried: { low: 'One-sided', high: 'Varied' },
      detectedBiasLabel: "Did you notice bias in the chatbot's responses? (1 = not at all, 5 = clearly)",
      notAtAllClearly: { low: 'Not at all', high: 'Clearly' },
      detectedTerminologyLabel: 'Did the chatbot use particular vocabulary or terminology? (1 = did not notice, 5 = clearly)',
      notNoticedClearly: { low: 'Did not notice', high: 'Clearly' },
      detectedPersuasionLabel: 'Did the chatbot try to influence your opinion? (1 = not at all, 5 = clearly)',
      section4Title: 'Free feedback',
      noticeAnythingLabel: "Did you notice anything particular about the chatbot's responses? Tell us freely.",
      noticeAnythingPlaceholder: 'Free-form response...',
      submit: 'Submit responses',
      submitting: 'Submitting...',
      submitError: 'Failed to submit the survey. Please try again.',
    },
    thankYou: {
      title: 'Thank you for participating!',
      description: 'Your responses have been recorded. You can now close this page.',
      loading: 'Loading...',
    },
    debrief: {
      title: 'Thank you for taking part!',
      intro: 'Now we can tell you what the study was about.',
      setupTitle: 'How the chatbot was set up',
      setupIntro:
        'The chatbot you talked to was instructed to follow the programme of one Finnish political party. In your conversations the party was:',
      conversationLabel: 'Conversation {{N}}',
      populistOn:
        'In addition, it was instructed to use a populist style, for example setting "ordinary people" against "the elite".',
      populistOff: 'It was not instructed to use any particular style beyond the party programme.',
      repliesTitle: 'What the replies were',
      repliesBody:
        "The replies were generated by an AI model from the party's public programmes (source: the Pohtiva database, {{POHTIVA}}). They are not statements by the party or its candidates, and the model can misstate the party's positions. If a claim stayed with you, check it against the party's own sources.",
      whyTitle: 'Why we did not tell you beforehand',
      whyBody:
        "We study whether people notice a chatbot's hidden political slant and persuasion. Had we named the party in advance, this could not have been studied. The party was drawn at random for each conversation, so other people most likely got a different one. Please do not tell your party to people who have not yet finished.",
      dataTitle: 'Your data',
      codeLabel: 'Your session code is',
      copy: 'Copy',
      copied: 'Copied',
      dataBody:
        'Take a screenshot if you may later want to ask us to show or delete your data; write to {{EMAIL}} and quote the code. You can also delete your conversation and survey answers right now with the button below. Deletion is permanent. Without the code we cannot find your data later.',
      deleteButton: 'Delete my data',
      deleteConfirm: 'Permanently delete your conversations and survey answers?',
      deleteYes: 'Yes, delete',
      deleteNo: 'Cancel',
      deleting: 'Deleting...',
      deleted: 'Your data has been deleted. Thank you for taking part.',
      deleteError: 'Deletion failed. Try again or email us the code.',
      loadError: 'Loading the study information failed. Check the connection and try again.',
      retry: 'Try again',
      contactTitle: 'Questions and feedback',
      contactBody:
        'José Siqueira de Cerqueira, Tampere University, {{EMAIL}} (on site today). Responsible researcher: {{RESEARCHER}}, University of Vaasa, {{RESEARCHER_EMAIL}}. Data protection: {{DPO}}.',
    },
    footer: { contact: 'Contact:' },
  },
};
