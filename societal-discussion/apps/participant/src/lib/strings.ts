// Participant-facing UI strings for the institutional pages, FI and EN.
// Consent wording comes from docs/consent/2026-10-23-metso-consent-package.md
// section 4c; the storage bullet says "stored on CSC servers in Finland" and
// never "encrypted" (spec section 5). The bullets carry two tokens that the
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
  chat: { placeholderTitle: string; placeholderBody: string; backToStart: string };
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
      placeholderBody: 'Keskustelusivu rakennetaan seuraavaksi (kortti M7). Istuntosi on tallessa.',
      backToStart: 'Takaisin alkuun',
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
      placeholderBody: 'The chat page is built next (card M7). Your session is kept.',
      backToStart: 'Back to start',
    },
    footer: { contact: 'Contact:' },
  },
};
