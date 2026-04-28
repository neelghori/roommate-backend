const mongoose = require('mongoose');

const LIFESTYLE_TAGS = [
  'Non-Smoker',
  'Vegetarian',
  'Non-Veg',
  'Early Bird',
  'Night Owl',
  'Pet Friendly',
  'Working',
  'Student',
];

const tenantRoommateProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    displayName: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    occupation: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    location: { type: String, required: true, trim: true, minlength: 3, maxlength: 200 },
    monthlyBudget: { type: Number, required: true, min: 1000, max: 500000 },
    moveInDate: { type: Date, required: true },
    bio: { type: String, required: true, trim: true, minlength: 20, maxlength: 2000 },
    lifestyleTags: {
      type: [String],
      required: true,
      validate: {
        validator(arr) {
          if (!Array.isArray(arr) || arr.length < 1 || arr.length > 10) return false;
          return arr.every((t) => LIFESTYLE_TAGS.includes(t));
        },
        message: 'Invalid or empty lifestyle tags',
      },
    },
    displayRole: {
      type: String,
      enum: ['Student', 'Working', 'Veg Only'],
      required: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

tenantRoommateProfileSchema.index({ displayName: 1, occupation: 1, location: 1 });
tenantRoommateProfileSchema.index({ lifestyleTags: 1 });
tenantRoommateProfileSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('TenantRoommateProfile', tenantRoommateProfileSchema);
