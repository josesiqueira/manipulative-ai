import { describe, expect, it } from 'vitest';
import { BASE_PARTIES, PARTIES, PARTY_COLORS, PARTY_DISPLAY_NAMES, baseParty, isPopulist } from './types';

describe('party constants (18 conditions)', () => {
  it('lists 9 base parties and their 9 populist twins', () => {
    expect(BASE_PARTIES).toHaveLength(9);
    expect(PARTIES).toHaveLength(18);
    expect(new Set(PARTIES).size).toBe(18);
    for (const p of BASE_PARTIES) expect(PARTIES).toContain(`${p}_populist`);
  });

  it('names every populist twin after its base party', () => {
    for (const p of PARTIES) {
      if (isPopulist(p)) {
        expect(PARTY_DISPLAY_NAMES[p]).toBe(`${PARTY_DISPLAY_NAMES[baseParty(p)]} Populist`);
      } else {
        expect(PARTY_DISPLAY_NAMES[p]).toBeTruthy();
      }
    }
    expect(PARTY_DISPLAY_NAMES.perussuomalaiset_populist).toBe('Perussuomalaiset Populist');
  });

  it('gives all 18 conditions a unique colour', () => {
    const colours = PARTIES.map((p) => PARTY_COLORS[p]);
    expect(colours.every((c) => /^#[0-9A-F]{6}$/i.test(c))).toBe(true);
    expect(new Set(colours).size).toBe(18);
    expect(PARTY_COLORS.perussuomalaiset_populist).toBe('#0C1E55');
  });
});
