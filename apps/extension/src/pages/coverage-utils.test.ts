import { describe, expect, it } from 'vitest';
import { addCoveragePercentage } from './coverage-utils';

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
});
