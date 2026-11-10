import { describe, expect, it } from 'vitest';
import {
  buildCodeDiscoveryQueries,
  buildCodeResourceQueries,
  buildFlowInventoryQueries,
  cleanEvidenceCitations,
} from './ai-code';

describe('AI code inspection', () => {
  it('creates bounded Tooling API discovery for a named local component', () => {
    const queries = buildCodeDiscoveryQueries(
      'What does Sync Now on `SocioWatch_Settings` do? Read its LWC code.',
    );
    expect(queries).toEqual([expect.stringContaining('FROM LightningComponentBundle')]);
    expect(queries[0]).toContain("DeveloperName LIKE '%SocioWatch_Settings%'");
    expect(queries[0]).toContain("DeveloperName LIKE '%SocioWatch%'");
  });

  it('loads source files only for discovered LWC and Aura bundles', () => {
    expect(
      buildCodeResourceQueries([
        {
          apiMode: 'tooling',
          query: 'SELECT Id FROM LightningComponentBundle',
          result: {
            totalSize: 1,
            done: true,
            elapsedMs: 1,
            records: [
              {
                Id: '0Rb000000000001AAA',
                attributes: { type: 'LightningComponentBundle' },
              },
            ],
          },
        },
      ])[0],
    ).toContain("LightningComponentBundleId IN ('0Rb000000000001AAA')");
  });

  it('removes internal evidence markers without damaging punctuation', () => {
    expect(cleanEvidenceCitations('Found five records. [E5][E6] Next step.')).toBe(
      'Found five records. Next step.',
    );
    expect(cleanEvidenceCitations('```js\n  const value = true; [E1]\n```')).toBe(
      '```js\n  const value = true;\n```',
    );
  });

  it('creates a bounded Tooling API inventory query when all Flow names are requested', () => {
    expect(buildFlowInventoryQueries('Give me the names of all flows in the org')).toEqual([
      expect.stringContaining('FROM FlowDefinition ORDER BY MasterLabel LIMIT 500'),
    ]);
    expect(buildFlowInventoryQueries('Help me design a flow')).toEqual([]);
  });
});
