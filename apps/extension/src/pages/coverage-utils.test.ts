import { describe, expect, it } from 'vitest';
import { addCoveragePercentage, orgWideCoveragePercentage } from './coverage-utils';

describe('coverage percentage', () => {
  it('calculates covered lines divided by total executable lines', () => {
    const result = addCoveragePercentage({
      ApexClassOrTrigger: { Name: 'InvoiceService' },
      NumLinesCovered: 8,
      NumLinesUncovered: 2,
    });
    expect(result).toEqual({
      Name: 'InvoiceService',
      Coverage: '80.00%',
      CoveredLines: 8,
      UncoveredLines: 2,
      TotalLines: 10,
    });
    expect(Object.keys(result).slice(0, 2)).toEqual(['Name', 'Coverage']);
  });

  it('handles an empty coverage result without dividing by zero', () => {
    expect(addCoveragePercentage({ NumLinesCovered: 0, NumLinesUncovered: 0 })).toMatchObject({
      Coverage: '0.00%',
      TotalLines: 0,
    });
  });

  it('reads the org-wide percentage returned by Salesforce', () => {
    expect(
      orgWideCoveragePercentage({
        totalSize: 1,
        done: true,
        records: [{ PercentCovered: 82 }],
        elapsedMs: 10,
      }),
    ).toBe(82);
    expect(
      orgWideCoveragePercentage({
        totalSize: 0,
        done: true,
        records: [],
        elapsedMs: 10,
      }),
    ).toBeUndefined();
  });
});
