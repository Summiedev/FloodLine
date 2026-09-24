import { normalizeEmail, normalizePhoneNumber } from './identity-normalization';

describe('identity normalization', () => {
  it('normalizes email whitespace and casing', () => {
    expect(normalizeEmail('  Person@Example.COM ')).toBe('person@example.com');
  });

  it('normalizes valid phone numbers to E.164', () => {
    expect(normalizePhoneNumber(' +234 801-234-5678 ')).toBe('+2348012345678');
    expect(normalizePhoneNumber('002348012345678')).toBe('+2348012345678');
  });

  it('rejects non-canonical phone numbers', () => {
    expect(() => normalizePhoneNumber('08012345678')).toThrow('valid E.164');
  });
});
