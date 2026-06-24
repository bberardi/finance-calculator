import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Regression for #68: the onboarding sample dates must be constructed in local
// time so they read back as the intended calendar date even for users west of
// UTC. A bare 'YYYY-MM-DD' string parses as UTC midnight, which reads back as
// the *previous day* (and sometimes prior month/year) in any negative-offset
// timezone — the bug this test guards against. The suite runs in UTC, so we
// force a western timezone and import the module under it so its date
// constructors evaluate there.
describe('sample data dates (#68)', () => {
  const originalTz = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = 'America/Los_Angeles';
  });
  afterAll(() => {
    process.env.TZ = originalTz;
  });

  const ymd = (d: Date): [number, number, number] => [
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
  ];

  it('reads back the intended local calendar date west of UTC', async () => {
    // Import under the western TZ so the module's date constructors run there.
    const { sampleLoans, sampleAssets } = await import('./sample-data');

    expect(ymd(sampleLoans[0].StartDate)).toEqual([2023, 4, 1]);
    expect(ymd(sampleLoans[0].EndDate)).toEqual([2053, 4, 1]);
    expect(ymd(sampleLoans[1].StartDate)).toEqual([2024, 1, 15]);
    expect(ymd(sampleLoans[1].EndDate)).toEqual([2029, 1, 15]);

    // The first two sample assets are the folded investments (AssetType.Investment).
    expect(ymd(sampleAssets[0].StartDate as Date)).toEqual([2021, 0, 1]);
    expect(ymd(sampleAssets[1].StartDate as Date)).toEqual([2019, 5, 1]);
  });
});
