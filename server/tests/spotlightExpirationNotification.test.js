const test = require('node:test');
const assert = require('node:assert/strict');
const { notifySpotlightExpirationChanged } = require('../utils/notificationService');

function createMockDb({
  managers = [],
  users = [],
  pageSettings = {},
  globalSettings = [
    { setting_key: 'enable_in_app_notifications', setting_value: 'true' },
    { setting_key: 'enable_email_notifications', setting_value: 'false' },
  ],
} = {}) {
  const inserted = [];
  const db = {
    inserted,
    async query(sql, params = []) {
      const text = String(sql);
      if (text.includes('ALTER TABLE') || text.includes('CREATE INDEX')) {
        return { rows: [], rowCount: 0 };
      }
      if (text.includes('FROM system_settings')) {
        return { rows: globalSettings, rowCount: globalSettings.length };
      }
      if (text.includes('FROM pages pg') && text.includes('UNION')) {
        return { rows: managers, rowCount: managers.length };
      }
      if (text.includes('SELECT page_name, notification_settings FROM pages')) {
        return { rows: [{ page_name: 'Student Affairs Office', notification_settings: pageSettings }], rowCount: 1 };
      }
      if (text.includes('FROM users u') && text.includes('ANY($1::int[])')) {
        const ids = params[0] || [];
        const matched = users.filter((u) => ids.includes(u.user_id));
        return { rows: matched, rowCount: matched.length };
      }
      if (text.includes('INSERT INTO notifications')) {
        // insertBatchNotifications uses UNNEST with 8 column arrays
        const [recipients, actors, pages, posts, scopes, types, titles, messages] = params;
        for (let i = 0; i < recipients.length; i += 1) {
          inserted.push({
            recipient_user_id: recipients[i],
            actor_user_id: actors[i],
            page_id: pages[i],
            post_id: posts[i],
            notification_scope: scopes[i],
            type: types[i],
            title: titles[i],
            message: messages[i],
          });
        }
        return { rows: [], rowCount: recipients.length };
      }
      return { rows: [], rowCount: 0 };
    },
  };
  return db;
}

test('notifySpotlightExpirationChanged notifies creator and active page managers (deduplicated, excluding acting admin) during approval', async () => {
  const db = createMockDb({
    managers: [{ user_id: 10 }, { user_id: 11 }, { user_id: 1 }],
    users: [
      { user_id: 10, email: 'staff1@wmsu.edu.ph', first_name: 'Maria', role_name: 'Staff', notification_preferences: {} },
      { user_id: 11, email: 'staff2@wmsu.edu.ph', first_name: 'Jose', role_name: 'Staff', notification_preferences: {} },
      { user_id: 1, email: 'admin@wmsu.edu.ph', first_name: 'Admin', role_name: 'Admin', notification_preferences: {} },
    ],
  });

  const count = await notifySpotlightExpirationChanged(db, {
    creatorUserId: 10,
    actorUserId: 1,
    pageId: 5,
    postId: 42,
    postType: 'event',
    title: 'Leadership Summit',
    previousExpiresAt: '2026-11-27T09:00:00.000Z',
    newExpiresAt: '2026-11-22T09:00:00.000Z',
    reason: 'Shortened to align with Enrollment Week.',
    duringApproval: true,
  });

  assert.equal(count, 2);
  assert.equal(db.inserted.length, 2);
  assert.deepEqual(
    db.inserted.map((n) => n.recipient_user_id).sort((a, b) => a - b),
    [10, 11]
  );
  for (const notif of db.inserted) {
    assert.equal(notif.notification_scope, 'mypage');
    assert.equal(notif.type, 'moderation');
    assert.match(notif.title, /Approved.*Expiration Adjusted/i);
    assert.match(notif.message, /Leadership Summit/);
    assert.match(notif.message, /Shortened to align with Enrollment Week\./);
  }
});

test('notifySpotlightExpirationChanged sends standalone update message when adjusted after approval and skips self-only edits safely', async () => {
  const db = createMockDb({
    managers: [{ user_id: 10 }],
    users: [
      { user_id: 10, email: 'staff1@wmsu.edu.ph', first_name: 'Maria', role_name: 'Staff', notification_preferences: {} },
    ],
  });

  const count = await notifySpotlightExpirationChanged(db, {
    creatorUserId: 10,
    actorUserId: 1,
    pageId: 5,
    postId: 42,
    postType: 'announcement',
    title: 'Campus Advisory',
    previousExpiresAt: '2026-11-27T09:00:00.000Z',
    newExpiresAt: '2026-11-30T09:00:00.000Z',
    reason: 'Extended for late enrollees.',
    duringApproval: false,
  });

  assert.equal(count, 1);
  assert.match(db.inserted[0].title, /Spotlight Expiration Updated/i);
  assert.match(db.inserted[0].message, /Extended for late enrollees\./);

  // Admin editing own post with no other managers -> safely returns 0
  const selfDb = createMockDb({
    managers: [{ user_id: 1 }],
    users: [{ user_id: 1, email: 'admin@wmsu.edu.ph', first_name: 'Admin', role_name: 'Admin', notification_preferences: {} }],
  });
  const selfCount = await notifySpotlightExpirationChanged(selfDb, {
    creatorUserId: 1,
    actorUserId: 1,
    pageId: 5,
    postId: 99,
    postType: 'announcement',
    title: 'Admin Own Post',
    previousExpiresAt: '2026-11-27T09:00:00.000Z',
    newExpiresAt: '2026-11-30T09:00:00.000Z',
    reason: 'Updated schedule.',
    duringApproval: false,
  });
  assert.equal(selfCount, 0);
  assert.equal(selfDb.inserted.length, 0);
});
