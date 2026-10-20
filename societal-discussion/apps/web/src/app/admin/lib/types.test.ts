import { describe, expect, it } from 'vitest';
import { BASE_PARTIES, PARTIES, PARTY_COLORS, PARTY_DISPLAY_NAMES, baseParty, isAntipopulist, isPopulist } from './types';

describe('party constants (18 conditions)', () => {
  it('lists 9 populist and 9 anti-populist variants, never the former standard ids', () => {
    expect(BASE_PARTIES).toHaveLength(9);
    expect(PARTIES).toHaveLength(18);
    expect(new Set(PARTIES).size).toBe(18);
    expect(PARTIES.filter(isPopulist)).toHaveLength(9);
    expect(PARTIES.filter(isAntipopulist)).toHaveLength(9);
    for (const p of BASE_PARTIES) {
      expect(PARTIES).toContain(`${p}_populist`);
      expect(PARTIES).toContain(`${p}_antipopulist`);
      expect(PARTIES).not.toContain(p);
    }
  });

  it('names every variant after its base party, and keeps names for earlier data', () => {
    for (const p of PARTIES) {
      const base = PARTY_DISPLAY_NAMES[baseParty(p)];
      expect(PARTY_DISPLAY_NAMES[p]).toBe(isPopulist(p) ? `${base} Populist` : `${base} Anti-populist`);
    }
    expect(PARTY_DISPLAY_NAMES.perussuomalaiset_populist).toBe('Perussuomalaiset Populist');
    expect(PARTY_DISPLAY_NAMES.kokoomus).toBe('Kokoomus');
  });

  it('gives all 18 conditions a unique colour', () => {
    const colours = PARTIES.map((p) => PARTY_COLORS[p]);
    expect(colours.every((c) => /^#[0-9A-F]{6}$/i.test(c))).toBe(true);
    expect(new Set(colours).size).toBe(18);
    expect(PARTY_COLORS.perussuomalaiset_populist).toBe('#0C1E55');
  });
});
