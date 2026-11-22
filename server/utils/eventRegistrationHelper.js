const PRESET_REQUIREMENTS = Object.freeze([
  { id: 'full_name', label: 'Full Name', fieldType: 'text', isCustom: false, autoFill: 'full_name', locked: false },
  { id: 'student_id', label: 'Student ID (Picture)', fieldType: 'image', isCustom: false, autoFill: 'student_id_image', locked: false },
  { id: 'course_and_year', label: 'Course and Year', fieldType: 'text', isCustom: false, autoFill: 'course_and_year', locked: true },
  { id: 'school_email', label: 'School Email', fieldType: 'text', isCustom: false, autoFill: 'email', locked: false },
  { id: 'contact_number', label: 'Contact Number', fieldType: 'text', isCustom: false, autoFill: null, locked: false },
  { id: 'cor', label: 'Certificate of Registration (COR)', fieldType: 'image', isCustom: false, autoFill: 'cor_image', locked: false },
  { id: 'parent_consent', label: "Parent's Consent or Waiver", fieldType: 'image', isCustom: false, autoFill: null, locked: false },
  { id: 'medical_certificate', label: 'Medical Certificate', fieldType: 'image', isCustom: false, autoFill: null, locked: false },
  { id: 'proof_of_payment', label: 'Proof of Payment', fieldType: 'image', isCustom: false, autoFill: null, locked: false },
]);

const PRESET_BY_ID = new Map(PRESET_REQUIREMENTS.map((item) => [item.id, item]));

let schemaPromise = null;

function ensureEventRegistrationSchema(pool) {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query(`
        ALTER TABLE event_details
          ADD COLUMN IF NOT EXISTS requires_registration BOOLEAN NOT NULL DEFAULT TRUE,
          ADD COLUMN IF NOT EXISTS registration_mode VARCHAR(32) NOT NULL DEFAULT 'first_come',
          ADD COLUMN IF NOT EXISTS registration_requirements JSONB NOT NULL DEFAULT '[]'::jsonb;
      `);
      await pool.query(`
        ALTER TABLE event_registrations
          ADD COLUMN IF NOT EXISTS submission_data JSONB NOT NULL DEFAULT '{}'::jsonb,
          ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
          ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS reviewed_by INT REFERENCES users(user_id) ON DELETE SET NULL;
      `);
      await pool.query(`
        ALTER TABLE event_registrations
          DROP CONSTRAINT IF EXISTS event_registrations_status_check;
        ALTER TABLE event_registrations
          ADD CONSTRAINT event_registrations_status_check
          CHECK (status IN ('Pending', 'Registered', 'Rejected', 'Attended', 'Cancelled'));
      `);
    })().catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}

function normalizeRegistrationMode(raw) {
  const mode = String(raw || '').trim().toLowerCase();
  if (mode === 'manual_approval') return 'manual_approval';
  return 'first_come';
}

function normalizeRegistrationRequirements(raw) {
  let list = raw;
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw);
    } catch {
      list = [];
    }
  }
  if (!Array.isArray(list)) return [];

  const seen = new Set();
  const normalized = [];

  for (let i = 0; i < list.length; i += 1) {
    const entry = list[i];
    if (typeof entry === 'string') {
      const preset = PRESET_BY_ID.get(entry.trim());
      if (preset && !seen.has(preset.id)) {
        seen.add(preset.id);
        normalized.push({ ...preset });
      }
      continue;
    }

    if (!entry || typeof entry !== 'object') continue;
    const rawId = String(entry.id || '').trim();
    const preset = PRESET_BY_ID.get(rawId);

    if (preset && !entry.isCustom) {
      if (!seen.has(preset.id)) {
        seen.add(preset.id);
        normalized.push({ ...preset });
      }
      continue;
    }

    const label = String(entry.label || '').trim();
    if (!label) continue;

    const fieldType = String(entry.fieldType || entry.type || '').toLowerCase() === 'image' ? 'image' : 'text';
    const customId = rawId || `custom_${i + 1}`;
    if (seen.has(customId)) continue;
    seen.add(customId);

    normalized.push({
      id: customId,
      label: label.slice(0, 120),
      fieldType,
      isCustom: true,
      autoFill: null,
      locked: false,
    });
  }

  return normalized;
}

function isValidImagePayload(val) {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  return /^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+$/.test(trimmed) || /^https?:\/\//i.test(trimmed);
}

function validateRegistrationSubmission(requirements = [], rawSubmission = {}, studentProfile = {}) {
  const normalizedReqs = normalizeRegistrationRequirements(requirements);
  const sub = rawSubmission && typeof rawSubmission === 'object' ? rawSubmission : {};
  const missing = [];
  const normalizedSubmission = {};

  for (const req of normalizedReqs) {
    const rawVal = sub[req.id];

    if (req.fieldType === 'image') {
      const wantsProfile =
        rawVal &&
        typeof rawVal === 'object' &&
        Boolean(rawVal.useProfileImage);

      let imageVal = null;
      let source = 'upload';

      if (wantsProfile) {
        if (req.id === 'student_id' && studentProfile.student_id_image_url) {
          imageVal = studentProfile.student_id_image_url;
          source = 'profile';
        } else if (req.id === 'cor' && studentProfile.cor_image_url) {
          imageVal = studentProfile.cor_image_url;
          source = 'profile';
        }
      } else if (typeof rawVal === 'string') {
        imageVal = rawVal.trim();
      } else if (rawVal && typeof rawVal === 'object' && typeof rawVal.value === 'string') {
        imageVal = rawVal.value.trim();
      }

      if (!imageVal || !isValidImagePayload(imageVal)) {
        missing.push(req.label);
        continue;
      }

      normalizedSubmission[req.id] = {
        id: req.id,
        label: req.label,
        fieldType: 'image',
        value: imageVal,
        source,
      };
      continue;
    }

    // Text field
    let textVal = '';
    if (req.locked && req.autoFill === 'course_and_year') {
      textVal = String(studentProfile.course_and_year || '').trim();
    } else if (typeof rawVal === 'string') {
      textVal = rawVal.trim();
    } else if (rawVal && typeof rawVal === 'object' && rawVal.value !== undefined) {
      textVal = String(rawVal.value || '').trim();
    } else if (req.autoFill && studentProfile[req.autoFill]) {
      textVal = String(studentProfile[req.autoFill]).trim();
    }

    if (!textVal) {
      missing.push(req.label);
      continue;
    }

    normalizedSubmission[req.id] = {
      id: req.id,
      label: req.label,
      fieldType: 'text',
      value: textVal,
      source: req.locked ? 'profile_locked' : 'input',
    };
  }

  if (missing.length > 0) {
    return {
      valid: false,
      missing,
      message: `Please complete the required fields: ${missing.join(', ')}.`,
      normalizedSubmission: {},
    };
  }

  return {
    valid: true,
    missing: [],
    message: null,
    normalizedSubmission,
  };
}

async function fetchUserRegistrationPrefill(db, userId) {
  const res = await db.query(
    `SELECT u.user_id,
            u.first_name,
            u.middle_initial,
            u.last_name,
            u.email,
            r.role_name,
            sp.student_number,
            sp.year_level,
            COALESCE(pr.program_name, d.department_name, '') AS course_name,
            d.department_name,
            CASE WHEN sp.cor_image IS NOT NULL
                 THEN 'data:' || COALESCE(sp.cor_mime_type, 'image/jpeg') || ';base64,' || encode(sp.cor_image, 'base64')
                 ELSE NULL END AS cor_image_url,
            CASE WHEN sp.student_id_image IS NOT NULL
                 THEN 'data:' || COALESCE(sp.student_id_mime_type, 'image/jpeg') || ';base64,' || encode(sp.student_id_image, 'base64')
                 ELSE NULL END AS student_id_image_url
     FROM users u
     LEFT JOIN roles r ON u.role_id = r.role_id
     LEFT JOIN student_profiles sp ON u.user_id = sp.user_id
     LEFT JOIN programs pr ON sp.program_id = pr.program_id
     LEFT JOIN departments d ON sp.department_id = d.department_id
     WHERE u.user_id = $1
     LIMIT 1`,
    [userId]
  );

  const row = res.rows[0];
  if (!row) {
    return {
      full_name: '',
      email: '',
      student_number: '',
      course_and_year: '',
      student_id_image_url: null,
      cor_image_url: null,
      has_saved_student_id_image: false,
      has_saved_cor_image: false,
    };
  }

  const nameParts = [row.first_name, row.middle_initial, row.last_name]
    .map((p) => (p || '').trim())
    .filter(Boolean);
  const fullName = nameParts.join(' ');
  const courseParts = [row.course_name, row.year_level]
    .map((p) => (p || '').trim())
    .filter(Boolean);
  let courseAndYear = courseParts.join(' • ');
  if (!courseAndYear && String(row.role_name || '').toLowerCase() !== 'student') {
    courseAndYear = 'Staff / Campus Member';
  }

  return {
    full_name: fullName,
    email: row.email || '',
    student_number: row.student_number || '',
    course_and_year: courseAndYear,
    student_id_image_url: row.student_id_image_url || null,
    cor_image_url: row.cor_image_url || null,
    has_saved_student_id_image: Boolean(row.student_id_image_url),
    has_saved_cor_image: Boolean(row.cor_image_url),
  };
}

module.exports = {
  PRESET_REQUIREMENTS,
  ensureEventRegistrationSchema,
  normalizeRegistrationMode,
  normalizeRegistrationRequirements,
  validateRegistrationSubmission,
  fetchUserRegistrationPrefill,
};
