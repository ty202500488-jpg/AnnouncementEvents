const test = require('node:test');
const assert = require('node:assert/strict');

const {
    evaluatePrePasswordGate,
    evaluatePostPasswordGate,
    parseRequireStudentVerification
} = require('../utils/verificationPolicy');

test('evaluatePrePasswordGate blocks Suspended and Archived accounts', () => {
    for (const accountStatus of ['Suspended', 'Archived']) {
        const res = evaluatePrePasswordGate({
            isEmailVerified: true,
            accountStatus,
            email: 'student@wmsu.edu.ph'
        });
        assert.equal(res.allowed, false);
        assert.equal(res.httpStatus, 403);
        assert.equal(res.code, 'SUSPENDED_OR_ARCHIVED');
        assert.equal(Boolean(res.payload.requiresEmailConfirmation), false);
    }
});

test('evaluatePrePasswordGate blocks unverified email and requests Gmail confirmation', () => {
    const res = evaluatePrePasswordGate({
        isEmailVerified: false,
        accountStatus: 'Pending',
        email: 'new@wmsu.edu.ph'
    });
    assert.equal(res.allowed, false);
    assert.equal(res.httpStatus, 403);
    assert.equal(res.code, 'EMAIL_UNVERIFIED');
    assert.equal(res.payload.requiresEmailConfirmation, true);
    assert.equal(res.payload.email, 'new@wmsu.edu.ph');
});

test('evaluatePrePasswordGate allows email-verified Pending accounts through to password check', () => {
    const res = evaluatePrePasswordGate({
        isEmailVerified: true,
        accountStatus: 'Pending',
        email: 'waiting@wmsu.edu.ph'
    });
    assert.deepEqual(res, { allowed: true });
});

test('evaluatePostPasswordGate blocks Pending student when verification is required', () => {
    const res = evaluatePostPasswordGate({
        roleName: 'Student',
        verificationStatus: 'Pending',
        verificationRemarks: null,
        requireStudentVerification: true
    });
    assert.equal(res.allowed, false);
    assert.equal(res.httpStatus, 403);
    assert.equal(res.code, 'ADMIN_PENDING');
    assert.equal(res.payload.requiresAdminVerification, true);
    assert.equal(res.payload.verificationState, 'pending');
    assert.equal(res.payload.verification_status, 'Pending');
    assert.equal(res.payload.verification_remarks, null);
});

test('evaluatePostPasswordGate returns correction state when Pending student has remarks', () => {
    const res = evaluatePostPasswordGate({
        roleName: 'Student',
        verificationStatus: 'Pending',
        verificationRemarks: 'COR photo is blurry, please retake clearly.',
        requireStudentVerification: true
    });
    assert.equal(res.allowed, false);
    assert.equal(res.httpStatus, 403);
    assert.equal(res.code, 'ADMIN_CORRECTION');
    assert.equal(res.payload.requiresAdminVerification, true);
    assert.equal(res.payload.verificationState, 'correction');
    assert.equal(res.payload.verification_remarks, 'COR photo is blurry, please retake clearly.');
});

test('evaluatePostPasswordGate blocks Rejected student with remarks', () => {
    const res = evaluatePostPasswordGate({
        roleName: 'Student',
        verificationStatus: 'Rejected',
        verificationRemarks: 'Invalid student ID submitted.',
        requireStudentVerification: true
    });
    assert.equal(res.allowed, false);
    assert.equal(res.httpStatus, 403);
    assert.equal(res.code, 'ADMIN_REJECTED');
    assert.equal(res.payload.requiresAdminVerification, true);
    assert.equal(res.payload.verificationState, 'rejected');
    assert.equal(res.payload.verification_status, 'Rejected');
    assert.equal(res.payload.verification_remarks, 'Invalid student ID submitted.');
});

test('evaluatePostPasswordGate allows Verified student', () => {
    const res = evaluatePostPasswordGate({
        roleName: 'Student',
        verificationStatus: 'Verified',
        verificationRemarks: null,
        requireStudentVerification: true
    });
    assert.deepEqual(res, { allowed: true });
});

test('evaluatePostPasswordGate allows Staff and Admin regardless of student verification status', () => {
    for (const roleName of ['Staff', 'Admin']) {
        const res = evaluatePostPasswordGate({
            roleName,
            verificationStatus: null,
            verificationRemarks: null,
            requireStudentVerification: true
        });
        assert.deepEqual(res, { allowed: true });
    }
});

test('evaluatePostPasswordGate allows Pending student when requireStudentVerification setting is false', () => {
    const res = evaluatePostPasswordGate({
        roleName: 'Student',
        verificationStatus: 'Pending',
        verificationRemarks: null,
        requireStudentVerification: false
    });
    assert.deepEqual(res, { allowed: true });
});

test('parseRequireStudentVerification handles JSONB booleans, strings, and missing rows', () => {
    assert.equal(parseRequireStudentVerification(undefined), true);
    assert.equal(parseRequireStudentVerification(null), true);
    assert.equal(parseRequireStudentVerification(true), true);
    assert.equal(parseRequireStudentVerification(false), false);
    assert.equal(parseRequireStudentVerification('false'), false);
    assert.equal(parseRequireStudentVerification('TRUE'), true);
});
