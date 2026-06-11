import { describe, expect, it } from 'vitest';
import { truncateAddress } from './format';

describe('truncateAddress', () => {
  it('shortens a full Stellar address to head…tail', () => {
    const g = 'GDUKMGUGDZQK6YHYAJ5Z6AY2G4XDSZPSZ3SW5UN3ARVMO6QSRDWP5YLEXAB';
    expect(truncateAddress(g)).toBe('GDUKMG…YLEXAB');
  });

  it('respects a custom edge length', () => {
    const g = 'GDUKMGUGDZQK6YHYAJ5Z6AY2G4XDSZPSZ3SW5UN3ARVMO6QSRDWP5YLEXAB';
    expect(truncateAddress(g, 4)).toBe('GDUK…EXAB');
  });

  it('returns short inputs unchanged', () => {
    expect(truncateAddress('GSHORT')).toBe('GSHORT');
  });
});
