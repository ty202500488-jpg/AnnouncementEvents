const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const { authenticateUser } = require('../middleware/auth');
const { getRequireStudentVerification } = require('../utils/verificationPolicy');
const pool = require('../db');

test.after(async () => {
    await pool.end();
});

function createMockRes() {
    return {
        statusCode: null,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        }
    };
}

test('authenticateUser rejects token signed with resubmit secret', async () => {
    const secret = process.env.JWT_SECRET || 'fallback_secret';
    const resubmitToken = jwt.sign(
        { userId: 42, purpose: 'cor_id_resubmit' },
        `${secret}:cor_resubmit`,
        { expiresIn: '30m' }
    );
    const req = { headers: { authorization: `Bearer ${resubmitToken}` }, query: {} };
    const res = createMockRes();

    const user = await authenticateUser(req, res);
    assert.equal(user, null);
    assert.equal(res.statusCode, 401);
});

test('authenticateUser rejects token signed with JWT_SECRET when decoded.purpose is set', async () => {
    const secret = process.env.JWT_SECRET || 'fallback_secret';
    const scopedToken = jwt.sign(
        { userId: 42, purpose: 'cor_id_resubmit' },
        secret,
        { expiresIn: '30m' }
    );
    const req = { headers: { authorization: `Bearer ${scopedToken}` }, query: {} };
    const res = createMockRes();

    const user = await authenticateUser(req, res);
    assert.equal(user, null);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.message, 'Invalid token scope.');
});

test('getRequireStudentVerification queries system_settings and defaults cleanly', async () => {
    assert.equal(await getRequireStudentVerification({ query: async () => ({ rows: [] }) }), true);
    assert.equal(
        await getRequireStudentVerification({ query: async () => ({ rows: [{ setting_value: false }] }) }),
        false
    );
    assert.equal(
        await getRequireStudentVerification({ query: async () => ({ rows: [{ setting_value: 'false' }] }) }),
        false
    );
    assert.equal(
        await getRequireStudentVerification({ query: async () => ({ rows: [{ setting_value: true }] }) }),
        true
    );
    assert.equal(
        await getRequireStudentVerification({
            query: async () => {
                throw new Error('relation does not exist');
            }
        }),
        true
    );
});
