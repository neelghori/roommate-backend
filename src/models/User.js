const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { USER_ROLES, PROFESSIONAL_TYPES, GENDER_OPTIONS } = require('../constants/roles');

const lifestyleSchema = new mongoose.Schema(
  {
    diet: { type: String, enum: ['vegetarian', 'non_vegetarian', 'eggetarian', 'vegan'], default: undefined },
    smoking: { type: String, enum: ['non_smoker', 'smoker'], default: undefined },
    maritalStatus: { type: String, enum: ['single', 'married', 'prefer_not_to_say'], default: undefined },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    mobile: {
      type: String,
      required: function mobileRequired() {
        if (this.googleId) return false;
        return this.role !== USER_ROLES.SUPERADMIN && this.role !== USER_ROLES.SUB_ADMIN;
      },
      trim: true,
      match: /^[0-9+\s()-]{10,15}$/,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    /** Google account subject (`sub` from ID token). */
    googleId: { type: String, trim: true, unique: true, sparse: true },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },
    role: {
      type: String,
      enum: [
        USER_ROLES.TENANT,
        USER_ROLES.OWNER,
        USER_ROLES.ROOMMATE,
        USER_ROLES.SUPERADMIN,
        USER_ROLES.SUB_ADMIN,
      ],
      required: true,
    },
    password: {
      type: String,
      required: function passwordRequired() {
        return !this.googleId;
      },
      minlength: 8,
      select: false,
    },
    professionalType: {
      type: String,
      enum: PROFESSIONAL_TYPES,
      required: function professionalTypeRequired() {
        return this.role !== USER_ROLES.SUPERADMIN && this.role !== USER_ROLES.SUB_ADMIN;
      },
    },
    lifestyle: lifestyleSchema,
    /** Derived from `dateOfBirth` when DOB is set via profile; may still be set alone at register. */
    age: { type: Number, min: 16, max: 120 },
    /** Calendar date of birth (UTC midnight for YYYY-MM-DD); PATCH /auth/me `dateOfBirth` updates `age`. */
    dateOfBirth: { type: Date },
    gender: { type: String, enum: GENDER_OPTIONS.filter((g) => g !== 'any') },
    profileImageUrl: { type: String, trim: true, maxlength: 2048 },
    /** In-app profile / roommate search preferences (PATCH /auth/me). */
    bio: { type: String, trim: true, maxlength: 2000 },
    location: { type: String, trim: true, maxlength: 200 },
    monthlyBudget: { type: Number, min: 0, max: 500000 },
    moveInDate: { type: Date },
    roommateGenderPreference: { type: String, enum: ['any', 'male', 'female'] },
    lifestyleTags: {
      type: [String],
      default: undefined,
      validate: {
        validator(arr) {
          if (!arr || !arr.length) return true;
          const allowed = new Set([
            'STUDENT',
            'WORKING',
            'VEGETARIAN',
            'NON_VEG',
            'SMOKER',
            'NON_SMOKER',
            'PET_FRIENDLY',
            'NIGHT_OWL',
            'EARLY_BIRD',
          ]);
          return arr.length <= 20 && arr.every((t) => allowed.has(t));
        },
        message: 'Invalid lifestyle tag',
      },
    },
    identityVerificationStatus: {
      type: String,
      enum: ['none', 'pending', 'verified', 'rejected'],
      default: 'none',
    },
    identityDocumentUrl: { type: String, trim: true, maxlength: 2048 },
    identitySubmittedAt: { type: Date },
    identityReviewedAt: { type: Date },
    identityReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    identityRejectionReason: { type: String, trim: true, maxlength: 500 },
    isActive: { type: Boolean, default: true },
    isStaff: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
    /** Confirmed via email link or set manually by super admin. */
    emailVerified: { type: Boolean, default: false },
    emailVerificationTokenHash: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    /** Super admin confirms mobile number out-of-band (manual). */
    mobileVerifiedByAdmin: { type: Boolean, default: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
  },
  { timestamps: true },
);

userSchema.index({ mobile: 1 });
userSchema.index({ role: 1 });
userSchema.index({ googleId: 1 }, { unique: true, sparse: true });

userSchema.pre('save', async function hashPassword(next) {
  if (this.isModified('password')) {
    this.passwordResetTokenHash = undefined;
    this.passwordResetExpires = undefined;
  }
  if (!this.isModified('password') || !this.password) return next();
  const env = require('../config/env');
  this.password = await bcrypt.hash(this.password, env.BCRYPT_SALT_ROUNDS);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeObject = function toSafeObject() {
  const o = this.toObject();
  delete o.password;
  delete o.passwordResetTokenHash;
  delete o.passwordResetExpires;
  delete o.emailVerificationTokenHash;
  delete o.emailVerificationExpires;
  o.isAadharVerified = o.identityVerificationStatus === 'verified';
  if (typeof o.emailVerified !== 'boolean') o.emailVerified = Boolean(o.emailVerified);
  if (typeof o.mobileVerifiedByAdmin !== 'boolean') {
    o.mobileVerifiedByAdmin = Boolean(o.mobileVerifiedByAdmin);
  }
  return o;
};

module.exports = mongoose.model('User', userSchema);
