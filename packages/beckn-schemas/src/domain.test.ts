import { describe, expect, it } from 'vitest';
import { LicenseClass, ResourceKind } from './domain.js';

describe('BDC domain vocabulary', () => {
  it('accepts valid resource kinds', () => {
    expect(ResourceKind.parse('dataset')).toBe('dataset');
    expect(ResourceKind.parse('model')).toBe('model');
  });

  it('rejects unknown resource kinds', () => {
    expect(() => ResourceKind.parse('spreadsheet')).toThrow();
  });

  it('accepts valid license classes', () => {
    expect(LicenseClass.parse('permissive')).toBe('permissive');
    expect(LicenseClass.parse('research-only')).toBe('research-only');
    expect(LicenseClass.parse('no-redistribution')).toBe('no-redistribution');
  });

  it('rejects unknown license classes', () => {
    expect(() => LicenseClass.parse('MIT')).toThrow();
  });
});
