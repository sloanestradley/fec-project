// Unit tests for toTitleCase (utils.js) — FEC "LAST, FIRST MIDDLE [HON] [SUFFIX]"
// → "First Middle Last Suffix". Exercised in page.evaluate over a page that loads
// utils.js (no mock, no DOM). Heuristic + accepted-imperfection cases are grounded
// in a 578-name live FEC sample; see the toTitleCase comment block in utils.js.
import { test, expect } from '@playwright/test';

test.describe('toTitleCase — name formatting', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/design-system.html'); // loads utils.js
  });

  const cases = [
    // [raw, expected, note]
    ['WILLIAMS, NIKEMA',            'Nikema Williams',        'plain first+last unchanged'],
    ['BIDEN, JOE R',               'Joe R Biden',            'trailing single-letter stays a middle initial'],
    ['BIDEN, JOSEPH R JR',         'Joseph R Biden Jr',      'JR suffix relocated + title-cased'],
    ['CARTER, ANTHONY SR.',        'Anthony Carter Sr',      'SR. suffix, period dropped'],
    ['BLACKBURN, MARSHA MRS.',     'Marsha Blackburn',       'trailing honorific stripped'],
    ['ALLEN, MRS. JIM',           'Jim Allen',              'leading honorific stripped'],
    ['AVANT, MRS C P',            'C P Avant',              'honorific before initials'],
    ['BARRETT, ROBERT PAUL MR JR.','Robert Paul Barrett Jr', 'honorific + suffix co-occur (MR before JR)'],
    ['KENNEDY, ANTHONY D MR. SR',  'Anthony D Kennedy Sr',   'honorific mid, SR suffix'],
    ['AIKEN, CURTIS MORRIS MR III','Curtis Morris Aiken III','MR stripped, III kept uppercase'],
    ['ARATA, LARRY V MR. III',     'Larry V Arata III',      'V stays initial; MR stripped; III suffix'],
    ['WILLIAMS, ARCHIE A., III',   'Archie A. Williams III', 'third comma segment is a suffix'],
    ['GOLDEN, KING JR.',          'King Golden Jr',         'first name that looks like a word + suffix'],
    ['ACEVEDO-CALVERT, DAPHNEY ROSARIO MRS.', 'Daphney Rosario Acevedo-Calvert', 'hyphenated last preserved'],
    ['KING, ANGUS S. JR.',        'Angus S. King Jr',       'initial with period + JR'],
    ['PEREZ, MARIE',              'Marie Perez',            'baseline'],
    ['SMITH',                     'Smith',                  'last-only (no comma)'],
    ['',                          '',                       'empty'],
    // accepted imperfection (1/578): single trailing V is treated as an initial
    ['BROUGH, PAUL MATTHEW KING V','Paul Matthew King V Brough', 'single V not relocated (documented trade)'],
  ];

  for (const [raw, expected, note] of cases) {
    test(`${note}: "${raw}" → "${expected}"`, async ({ page }) => {
      const out = await page.evaluate((n) => window.toTitleCase(n), raw);
      expect(out).toBe(expected);
    });
  }

  test('formatCandidateName is a semantic alias for toTitleCase', async ({ page }) => {
    const [a, b] = await page.evaluate(() => [
      window.formatCandidateName('BIDEN, JOSEPH R JR'),
      window.toTitleCase('BIDEN, JOSEPH R JR'),
    ]);
    expect(a).toBe(b);
    expect(a).toBe('Joseph R Biden Jr');
  });
});
