const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeSearchFilter,
  formatPageTypeLabel,
  normalizeLimit,
  searchPortalContent,
} = require('../utils/searchHelper');

test('normalizeSearchFilter normalizes supported category aliases', () => {
  assert.equal(normalizeSearchFilter('all'), 'all');
  assert.equal(normalizeSearchFilter(''), 'all');
  assert.equal(normalizeSearchFilter('unknown'), 'all');
  assert.equal(normalizeSearchFilter('announcements'), 'announcements');
  assert.equal(normalizeSearchFilter('announcement'), 'announcements');
  assert.equal(normalizeSearchFilter('events'), 'events');
  assert.equal(normalizeSearchFilter('event'), 'events');
  assert.equal(normalizeSearchFilter('departments'), 'pages');
  assert.equal(normalizeSearchFilter('department'), 'pages');
  assert.equal(normalizeSearchFilter('pages'), 'pages');
  assert.equal(normalizeSearchFilter('page'), 'pages');
});

test('formatPageTypeLabel maps page types to human-readable labels', () => {
  assert.equal(formatPageTypeLabel('department'), 'Department Page');
  assert.equal(formatPageTypeLabel('organization'), 'Organization Page');
  assert.equal(formatPageTypeLabel('office'), 'Office Page');
  assert.equal(formatPageTypeLabel(undefined), 'Department Page');
});

test('normalizeLimit clamps and defaults limit safely', () => {
  assert.equal(normalizeLimit(undefined), 15);
  assert.equal(normalizeLimit('abc'), 15);
  assert.equal(normalizeLimit(0), 15);
  assert.equal(normalizeLimit(-5), 15);
  assert.equal(normalizeLimit(10), 10);
  assert.equal(normalizeLimit(200), 50);
});

test('searchPortalContent returns empty array without querying DB for blank query', async () => {
  let queried = false;
  const mockDb = {
    async query() {
      queried = true;
      return { rows: [] };
    },
  };

  const results = await searchPortalContent(mockDb, { query: '   ', type: 'all' });
  assert.deepEqual(results, []);
  assert.equal(queried, false);
});

test('searchPortalContent queries pages and posts for type=all and formats results', async () => {
  const calls = [];
  const mockDb = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('FROM pages p')) {
        return {
          rows: [
            {
              id: 3,
              title: 'College of Computing Studies',
              code: 'CCS',
              page_type: 'department',
              description: 'Computing department',
            },
          ],
        };
      }
      return {
        rows: [
          {
            id: 3,
            post_type: 'announcement',
            title: 'CCS Enrollment Advisory',
            content: 'Enrollment opens Monday',
            page_id: 3,
            page_name: 'College of Computing Studies',
            page_code: 'CCS',
            category_name: 'Academic',
            event_date: null,
            location: null,
          },
          {
            id: 9,
            post_type: 'event',
            title: 'Tech Summit',
            content: 'Annual CCS summit',
            page_id: 3,
            page_name: 'College of Computing Studies',
            page_code: 'CCS',
            category_name: 'Technology',
            event_date: '2026-11-20T09:00:00.000Z',
            location: 'WMSU Gym',
          },
        ],
      };
    },
  };

  const results = await searchPortalContent(mockDb, {
    query: 'CCS',
    type: 'all',
    userId: 12,
    limit: 10,
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].params[0], '%CCS%');
  assert.equal(calls[0].params[1], 'CCS%');
  assert.equal(calls[0].params[2], 10);

  assert.equal(calls[1].params[0], '%CCS%');
  assert.equal(calls[1].params[1], 'CCS%');
  assert.equal(calls[1].params[2], 12);
  assert.equal(calls[1].params[3], null);
  assert.equal(calls[1].params[4], 10);

  assert.equal(results.length, 3);
  // Prefix matches ('CCS Enrollment Advisory') rank before non-prefix matches
  assert.equal(results[0].key, 'announcement-3');
  assert.equal(results[0].type, 'announcement');
  assert.equal(results[0].typeLabel, 'Announcement');
  assert.equal(results[0].subtitle, 'CCS • Academic');

  const pageItem = results.find((r) => r.type === 'page');
  assert.equal(pageItem.key, 'page-3');
  assert.equal(pageItem.typeLabel, 'Department Page');
  assert.equal(pageItem.category, 'departments');
  assert.equal(pageItem.subtitle, 'CCS');

  const eventItem = results.find((r) => r.type === 'event');
  assert.equal(eventItem.key, 'event-9');
  assert.equal(eventItem.typeLabel, 'Event');
  assert.equal(eventItem.subtitle, 'CCS • WMSU Gym');
});

test('searchPortalContent filters strictly by announcements, events, or departments', async () => {
  const seen = [];
  const mockDb = {
    async query(sql, params) {
      seen.push({ isPages: sql.includes('FROM pages p'), params });
      return { rows: [] };
    },
  };

  await searchPortalContent(mockDb, { query: 'orientation', type: 'announcements' });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].isPages, false);
  assert.equal(seen[0].params[3], 'announcement');

  seen.length = 0;
  await searchPortalContent(mockDb, { query: 'orientation', type: 'events' });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].isPages, false);
  assert.equal(seen[0].params[3], 'event');

  seen.length = 0;
  await searchPortalContent(mockDb, { query: 'engineering', type: 'departments' });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].isPages, true);
});
