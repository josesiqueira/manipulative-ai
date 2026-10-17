// Facts that appear in participant-facing texts and that the DPOs or the
// ethics committee may still change. Values are the recommended ones from
// docs/consent/2026-10-23-metso-consent-package.md section 2 (spec V15);
// Jose confirms or replaces each on board card M10 before the deploy.
export const STUDY = {
  // Bump whenever the consent screen, research notification or privacy
  // notice wording changes; stored on every session.
  consentVersion: '2026-10-23-v1',
  retentionEnd: { fi: '31.12.2028', en: '31 December 2028' },
  controllers: {
    fi: 'Tampereen yliopisto ja Vaasan yliopisto',
    en: 'Tampere University and the University of Vaasa',
  },
  ageThreshold: 18,
  closingDate: { fi: '24.10.2026', en: '24 October 2026' },
  contactEmail: 'jose.siqueiradecerqueira@tuni.fi',
  responsibleResearcher: 'Rebekah Rousi',
  responsibleResearcherEmail: 'rebekah.rousi@uwasa.fi',
  dpoEmail: 'tietosuojavastaava@uwasa.fi',
  pohtivaUrl: 'https://www.fsd.tuni.fi/pohtiva/',
  // Filled when M9 names the model; until then the notices show the bracket.
  modelName: '[MODEL NAME]',
} as const;
