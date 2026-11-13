const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function sendVerificationEmail(toEmail, firstName, confirmUrl) {
    const autoConfirmInDev =
        process.env.NODE_ENV === 'development' && process.env.ENABLE_DEV_EMAIL_FALLBACK === 'true';
    const safeName = escapeHtml(firstName || 'Student');

    try {
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            await transporter.sendMail({
                from: `"WMSU CampusHub" <${process.env.EMAIL_USER}>`,
                to: toEmail,
                subject: 'CRIMSON - Confirm Your Email Address',
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px;">
                        <h2 style="color: #800000;">Welcome to CRIMSON, ${safeName}!</h2>
                        <p>Please confirm your institutional email address by clicking the button below. Once confirmed, an Administrator will review your uploaded COR and Student ID before activating sign-in access.</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${confirmUrl}" style="background-color: #800000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Confirm Email Address</a>
                        </div>
                    </div>
                `
            });
            return { sent: true };
        } else if (autoConfirmInDev) {
            console.log('🔗 [DEV FALLBACK] CONFIRMATION LINK:', confirmUrl);
            return { sent: true, fallback: true };
        }
        return { sent: false };
    } catch (emailErr) {
        if (autoConfirmInDev) {
            console.log('🔗 [DEV FALLBACK] CONFIRMATION LINK:', confirmUrl);
            return { sent: true, fallback: true };
        }
        throw emailErr;
    }
}

/**
 * Send best-effort Gmail notification after an Administrator reviews a student's COR & ID.
 * Never throws so Admin approval/rejection DB updates still succeed if SMTP is unconfigured.
 */
async function sendStudentVerificationDecisionEmail({
    toEmail,
    firstName,
    decisionStatus,
    remarks,
    portalUrl = process.env.CLIENT_URL || 'http://localhost:5173'
}) {
    if (!toEmail || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        return { sent: false, skipped: true };
    }

    const safeName = escapeHtml(firstName || 'Student');
    const safeRemarks = remarks ? escapeHtml(remarks) : '';
    const norm = String(decisionStatus || '').toLowerCase();

    let subject = 'CRIMSON - Student Verification Update';
    let heading = 'Student Verification Update';
    let bodyHtml = '';
    let buttonText = 'Open CRIMSON Portal';
    const loginUrl = `${String(portalUrl).replace(/\/$/, '')}/auth`;

    if (norm === 'verified') {
        subject = 'CRIMSON - Your Student Account Has Been Approved!';
        heading = 'Verification Approved';
        bodyHtml = `
            <p>Good news, ${safeName}! An Administrator has reviewed and approved your Certificate of Registration (COR) and WMSU Student ID.</p>
            <p>Your account is now fully active and you may sign in to the CRIMSON portal.</p>
        `;
        buttonText = 'Sign In Now';
    } else if (norm === 'rejected') {
        subject = 'CRIMSON - Student Verification Rejected';
        heading = 'Verification Rejected';
        bodyHtml = `
            <p>Hello ${safeName}, unfortunately your student verification documents could not be approved by an Administrator.</p>
            ${safeRemarks ? `<p><strong>Reason:</strong> ${safeRemarks}</p>` : ''}
            <p>Please review the remarks above or reach out to the Administration office for assistance.</p>
        `;
    } else {
        subject = 'CRIMSON - Action Required: Resubmit Your COR & Student ID';
        heading = 'Verification Requires Corrections';
        bodyHtml = `
            <p>Hello ${safeName}, an Administrator reviewed your verification submission and requested corrections before activating your account.</p>
            ${safeRemarks ? `<p><strong>Admin Remarks:</strong> ${safeRemarks}</p>` : ''}
            <p>Please sign in on the CRIMSON login page with your email and password to capture and re-submit clear photos of your COR and Student ID.</p>
        `;
        buttonText = 'Re-submit Documents';
    }

    try {
        await transporter.sendMail({
            from: `"WMSU CampusHub" <${process.env.EMAIL_USER}>`,
            to: toEmail,
            subject,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #800000;">${heading}</h2>
                    ${bodyHtml}
                    <div style="text-align: center; margin: 28px 0;">
                        <a href="${loginUrl}" style="background-color: #800000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">${buttonText}</a>
                    </div>
                </div>
            `
        });
        return { sent: true };
    } catch (err) {
        console.warn('Student verification decision email failed:', err.message);
        return { sent: false, error: err.message };
    }
}

/**
 * Whether Gmail SMTP credentials are configured in the server environment.
 */
function isEmailConfigured() {
    return Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

/**
 * Send best-effort generic notification email (honors opt-in page/system settings).
 */
async function sendNotificationEmail({
    toEmail,
    firstName,
    subject,
    heading,
    message,
    actionUrl,
    actionLabel = 'Open CRIMSON Portal'
}) {
    if (!toEmail || !isEmailConfigured()) {
        return { sent: false, skipped: true };
    }

    const safeName = escapeHtml(firstName || 'Campus User');
    const safeHeading = escapeHtml(heading || subject || 'Campus Notification');
    const safeMessage = escapeHtml(message || '');
    const portalBase = String(process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
    const resolvedUrl = actionUrl
        ? (String(actionUrl).startsWith('http') ? actionUrl : `${portalBase}${actionUrl.startsWith('/') ? '' : '/'}${actionUrl}`)
        : portalBase;

    try {
        await transporter.sendMail({
            from: `"WMSU CampusHub" <${process.env.EMAIL_USER}>`,
            to: toEmail,
            subject: subject || `CRIMSON - ${heading || 'New Notification'}`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #800000;">${safeHeading}</h2>
                    <p>Hello ${safeName},</p>
                    <p>${safeMessage}</p>
                    <div style="text-align: center; margin: 28px 0;">
                        <a href="${escapeHtml(resolvedUrl)}" style="background-color: #800000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">${escapeHtml(actionLabel)}</a>
                    </div>
                </div>
            `
        });
        return { sent: true };
    } catch (err) {
        console.warn('Notification email dispatch failed:', err.message);
        return { sent: false, error: err.message };
    }
}

module.exports = {
    isEmailConfigured,
    sendVerificationEmail,
    sendStudentVerificationDecisionEmail,
    sendNotificationEmail
};
