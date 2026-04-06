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
    role: {
      type: String,
      enum: [USER_ROLES.TENANT, USER_ROLES.OWNER, USER_ROLES.SUPERADMIN, USER_ROLES.SUB_ADMIN],
      required: true,
    },
    password: { type: String, required: true, minlength: 8, select: false },
    professionalType: {
      type: String,
      enum: PROFESSIONAL_TYPES,
      required: function professionalTypeRequired() {
        return this.role !== USER_ROLES.SUPERADMIN && this.role !== USER_ROLES.SUB_ADMIN;
      },
    },
    lifestyle: lifestyleSchema,
    age: { type: Number, min: 16, max: 120 },
    gender: { type: String, enum: GENDER_OPTIONS.filter((g) => g !== 'any') },
    profileImageUrl: { type: String, trim: true, maxlength: 2048 },
    isActive: { type: Boolean, default: true },
    isStaff: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
  },
  { timestamps: true },
);

userSchema.index({ mobile: 1 });
userSchema.index({ role: 1 });

userSchema.pre('save', async function hashPassword(next) {
  if (this.isModified('password')) {
    this.passwordResetTokenHash = undefined;
    this.passwordResetExpires = undefined;
  }
  if (!this.isModified('password')) return next();
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
  return o;
};

module.exports = mongoose.model('User', userSchema);
