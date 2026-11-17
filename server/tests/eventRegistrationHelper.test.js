const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PRESET_REQUIREMENTS,
  normalizeRegistrationMode,
  normalizeRegistrationRequirements,
  validateRegistrationSubmission,
  fetchUserRegistrationPrefill,
} = require('../utils/eventRegistrationHelper');

test('PRESET_REQUIREMENTS includes all 9 expected student requirement presets', () => {
  const keys = PRESET_REQUIREMENTS.map((item) => item.id);
  assert.deepEqual(keys, [
    'full_name',
    'student_id',
    'course_and_year',
    'school_email',
    'contact_number',
    'cor',
    'parent_consent',
    'medical_certificate',
    'proof_of_payment',
  ]);
  const courseReq = PRESET_REQUIREMENTS.find((item) => item.id === 'course_and_year');
  assert.equal(courseReq.fieldType, 'text');
  assert.equal(courseReq.locked, true);
});

test('normalizeRegistrationMode accepts first_come and manual_approval and defaults safely', () => {
  assert.equal(normalizeRegistrationMode('first_come'), 'first_come');
  assert.equal(normalizeRegistrationMode('manual_approval'), 'manual_approval');
  assert.equal(normalizeRegistrationMode('MANUAL_APPROVAL'), 'manual_approval');
  assert.equal(normalizeRegistrationMode('unknown'), 'first_come');
  assert.equal(normalizeRegistrationMode(undefined), 'first_come');
});

test('normalizeRegistrationRequirements normalizes preset IDs and custom Others entries', () => {
  const normalized = normalizeRegistrationRequirements([
    'full_name',
    { id: 'course_and_year' },
    { id: 'custom_1', label: '  T-Shirt Size  ', fieldType: 'text', isCustom: true },
    { id: 'custom_2', label: 'Vaccination Card', fieldType: 'image', isCustom: true },
    { id: 'custom_blank', label: '   ', fieldType: 'text', isCustom: true },
    'full_name',
  ]);

  assert.equal(normalized.length, 4);
  assert.deepEqual(normalized[0], {
    id: 'full_name',
    label: 'Full Name',
    fieldType: 'text',
    isCustom: false,
    autoFill: 'full_name',
    locked: false,
  });
  assert.deepEqual(normalized[1], {
    id: 'course_and_year',
    label: 'Course and Year',
    fieldType: 'text',
    isCustom: false,
    autoFill: 'course_and_year',
    locked: true,
  });
  assert.deepEqual(normalized[2], {
    id: 'custom_1',
    label: 'T-Shirt Size',
    fieldType: 'text',
    isCustom: true,
    autoFill: null,
    locked: false,
  });
  assert.deepEqual(normalized[3], {
    id: 'custom_2',
    label: 'Vaccination Card',
    fieldType: 'image',
    isCustom: true,
    autoFill: null,
    locked: false,
  });
});

test('validateRegistrationSubmission enforces required text/image fields and auto-fills locked course_and_year', () => {
  const requirements = normalizeRegistrationRequirements([
    'full_name',
    'course_and_year',
    'student_id',
    { id: 'custom_size', label: 'T-Shirt Size', fieldType: 'text', isCustom: true },
  ]);

  const profile = {
    full_name: 'Juan Dela Cruz',
    course_and_year: 'BS Computer Science • 3rd Year',
    email: 'juan@wmsu.edu.ph',
    student_id_image_url: 'data:image/png;base64,AAAA',
    cor_image_url: 'data:image/png;base64,BBBB',
  };

  // Missing custom_size and student_id
  const failRes = validateRegistrationSubmission(
    requirements,
    {
      full_name: 'Juan Dela Cruz',
      course_and_year: 'Fake Course',
    },
    profile
  );
  assert.equal(failRes.valid, false);
  assert.deepEqual(failRes.missing, ['Student ID (Picture)', 'T-Shirt Size']);

  // Satisfied via profile image + custom text, locked course_and_year overridden by profile
  const okRes = validateRegistrationSubmission(
    requirements,
    {
      full_name: 'Juan Dela Cruz',
      course_and_year: 'Fake Course',
      student_id: { useProfileImage: true },
      custom_size: 'Large',
    },
    profile
  );
  assert.equal(okRes.valid, true);
  assert.equal(okRes.normalizedSubmission.course_and_year.value, 'BS Computer Science • 3rd Year');
  assert.equal(okRes.normalizedSubmission.student_id.value, 'data:image/png;base64,AAAA');
  assert.equal(okRes.normalizedSubmission.student_id.source, 'profile');
  assert.equal(okRes.normalizedSubmission.custom_size.value, 'Large');
  assert.equal(okRes.normalizedSubmission.custom_size.fieldType, 'text');
});

test('validateRegistrationSubmission rejects useProfileImage when profile lacks saved image and validates custom image format', () => {
  const requirements = normalizeRegistrationRequirements([
    'cor',
    { id: 'custom_vax', label: 'Vaccination Card', fieldType: 'image', isCustom: true },
  ]);

  const noImageProfile = {
    cor_image_url: null,
    student_id_image_url: null,
  };

  const failRes = validateRegistrationSubmission(
    requirements,
    {
      cor: { useProfileImage: true },
      custom_vax: 'not-an-image-string',
    },
    noImageProfile
  );
  assert.equal(failRes.valid, false);
  assert.deepEqual(failRes.missing, ['Certificate of Registration (COR)', 'Vaccination Card']);

  const okRes = validateRegistrationSubmission(
    requirements,
    {
      cor: 'data:image/jpeg;base64,/9j/4AAQ',
      custom_vax: 'data:image/png;base64,iVBORw0K',
    },
    noImageProfile
  );
  assert.equal(okRes.valid, true);
  assert.equal(okRes.normalizedSubmission.cor.source, 'upload');
  assert.equal(okRes.normalizedSubmission.custom_vax.fieldType, 'image');
});

test('fetchUserRegistrationPrefill combines student name, course and year, and saved images', async () => {
  const mockDb = {
    async query() {
      return {
        rows: [
          {
            user_id: 7,
            first_name: 'Maria',
            middle_initial: 'S.',
            last_name: 'Santos',
            email: 'maria@wmsu.edu.ph',
            role_name: 'student',
            student_number: '2025-00123',
            year_level: '2nd Year',
            course_name: 'BS Information Technology',
            department_name: 'College of Computing Studies',
            cor_image_url: 'data:image/jpeg;base64,COR123',
            student_id_image_url: null,
          },
        ],
      };
    },
  };

  const prefill = await fetchUserRegistrationPrefill(mockDb, 7);
  assert.equal(prefill.full_name, 'Maria S. Santos');
  assert.equal(prefill.email, 'maria@wmsu.edu.ph');
  assert.equal(prefill.course_and_year, 'BS Information Technology • 2nd Year');
  assert.equal(prefill.has_saved_cor_image, true);
  assert.equal(prefill.has_saved_student_id_image, false);
});
