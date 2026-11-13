/**
 * Parse the `require_student_id_cor_verification` system_settings value.
 * Defaults to true when not configured.
 */
function parseRequireStudentVerification(rawValue) {
    if (rawValue === undefined || rawValue === null) return true;
    if (typeof rawValue === 'boolean') return rawValue;
    if (typeof rawValue === 'string') {
        const normalized = rawValue.trim().toLowerCase();
        if (normalized === 'false' || normalized === '0') return false;
        if (normalized === 'true' || normalized === '1') return true;
    }
    return Boolean(rawValue);
}

/**
 * Query system_settings for `require_student_id_cor_verification`.
 */
async function getRequireStudentVerification(db) {
    try {
        const res = await db.query(
            `SELECT setting_value FROM system_settings WHERE setting_key = 'require_student_id_cor_verification' LIMIT 1`
        );
        if (!res.rows || res.rows.length === 0) return true;
        return parseRequireStudentVerification(res.rows[0].setting_value);
    } catch (_) {
        return true;
    }
}

/**
 * Evaluate login blockers that do not depend on student COR/ID status
 * (run BEFORE verifying password so unverified-email or suspended accounts fail early).
 * Note: account_status === 'Pending' is allowed through here when isEmailVerified === true
 * so password verification happens before disclosing Admin verification status/remarks.
 */
function evaluatePrePasswordGate({ isEmailVerified, accountStatus, email }) {
    const normalizedStatus = String(accountStatus || '').trim().toLowerCase();

    if (normalizedStatus === 'suspended' || normalizedStatus === 'archived') {
        return {
            allowed: false,
            httpStatus: 403,
            code: 'SUSPENDED_OR_ARCHIVED',
            payload: {
                message: `Your account is currently ${accountStatus}.`
            }
        };
    }

    if (!isEmailVerified) {
        return {
            allowed: false,
            httpStatus: 403,
            code: 'EMAIL_UNVERIFIED',
            payload: {
                message: 'Please confirm your email address via the link sent to your Gmail before signing in.',
                requiresEmailConfirmation: true,
                email
            }
        };
    }

    return { allowed: true };
}

/**
 * Evaluate two-stage Admin student COR & ID verification gate AFTER password verification.
 */
function evaluatePostPasswordGate({
    roleName,
    verificationStatus,
    verificationRemarks,
    requireStudentVerification = true
}) {
    const normalizedRole = String(roleName || '').trim().toLowerCase();
    if (normalizedRole !== 'student' || !requireStudentVerification) {
        return { allowed: true };
    }

    const rawStatus = verificationStatus || 'Pending';
    const normalizedVerif = String(rawStatus).trim().toLowerCase();
    if (normalizedVerif === 'verified') {
        return { allowed: true };
    }

    const trimmedRemarks =
        typeof verificationRemarks === 'string' && verificationRemarks.trim()
            ? verificationRemarks.trim()
            : null;

    if (normalizedVerif === 'rejected') {
        return {
            allowed: false,
            httpStatus: 403,
            code: 'ADMIN_REJECTED',
            payload: {
                requiresAdminVerification: true,
                verificationState: 'rejected',
                verification_status: 'Rejected',
                verification_remarks: trimmedRemarks,
                message: trimmedRemarks
                    ? `Your student verification was rejected: ${trimmedRemarks}`
                    : 'Your student verification was rejected by an Administrator. Please contact the administration office.'
            }
        };
    }

    if (trimmedRemarks) {
        return {
            allowed: false,
            httpStatus: 403,
            code: 'ADMIN_CORRECTION',
            payload: {
                requiresAdminVerification: true,
                verificationState: 'correction',
                verification_status: rawStatus,
                verification_remarks: trimmedRemarks,
                message: 'Administrator requested corrections to your COR or Student ID before your account can be activated.'
            }
        };
    }

    return {
        allowed: false,
        httpStatus: 403,
        code: 'ADMIN_PENDING',
        payload: {
            requiresAdminVerification: true,
            verificationState: 'pending',
            verification_status: rawStatus,
            verification_remarks: null,
            message: 'Your email is confirmed, and your COR & Student ID are currently awaiting Administrator verification before you can sign in.'
        }
    };
}

module.exports = {
    parseRequireStudentVerification,
    getRequireStudentVerification,
    evaluatePrePasswordGate,
    evaluatePostPasswordGate
};
