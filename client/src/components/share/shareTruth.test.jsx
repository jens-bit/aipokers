import { describe, it, expect } from 'vitest';
import { buildShareModel } from './shareModel.js';
describe('BUG-114 share accounting', () => {
  it('labels old records as a pot, never personal winnings or losses', () => {
    for (const won of [true, false]) expect(buildShareModel({
      pot: 1840,
      won
    }).amount).toBe('$1,840 pot');
  });
  it('uses signed stack change, including a split-pot winner with a net loss', () => {
    expect(buildShareModel({
      pot: 1840,
      won: true,
      net: -120
    }).amount).toBe('−$120');
    expect(buildShareModel({
      pot: 1840,
      won: true,
      net: 920
    }).amount).toBe('+$920');
    expect(buildShareModel({
      pot: 1840,
      won: true,
      net: 0
    }).amount).toBe('$0');
  });
});
