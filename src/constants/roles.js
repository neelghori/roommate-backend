const USER_ROLES = {
  TENANT: 'tenant',
  OWNER: 'owner',
  /** Seeking a shared flat / roommate (tenant-like app access) */
  ROOMMATE: 'roommate',
  SUPERADMIN: 'superadmin',
  SUB_ADMIN: 'sub_admin',
};

/** Roles that may use admin JWT and /admin/auth/* */
const ADMIN_PANEL_ROLES = [USER_ROLES.SUPERADMIN, USER_ROLES.SUB_ADMIN];

/** JWT `aud` — app and admin tokens are not interchangeable */
const JWT_AUDIENCE = {
  APP: 'roommate-app',
  ADMIN: 'roommate-admin',
};

const PROFESSIONAL_TYPES = [
  'student',
  'work_professional',
  'freelancer',
  'business',
  'other',
];

const LISTING_TYPES = ['room', 'flat', 'pg', 'roommate_seeker', 'coworking_space', 'house'];

/** Preferred tenant / occupant categories (multi-select on listings). */
const PEOPLE_TYPES = ['bachelor', 'working', 'family'];

const GENDER_OPTIONS = ['male', 'female', 'other', 'any'];

module.exports = {
  USER_ROLES,
  ADMIN_PANEL_ROLES,
  JWT_AUDIENCE,
  PROFESSIONAL_TYPES,
  LISTING_TYPES,
  PEOPLE_TYPES,
  GENDER_OPTIONS,
};
