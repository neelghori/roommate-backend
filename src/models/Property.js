const mongoose = require('mongoose');
const { LISTING_TYPES, GENDER_OPTIONS, PROFESSIONAL_TYPES } = require('../constants/roles');

const lifestyleSnippetSchema = new mongoose.Schema(
  {
    diet: { type: String, enum: ['vegetarian', 'non_vegetarian', 'eggetarian', 'vegan'] },
    smoking: { type: String, enum: ['non_smoker', 'smoker'] },
  },
  { _id: false },
);

const listerContextSchema = new mongoose.Schema(
  {
    fullName: { type: String, trim: true, maxlength: 120 },
    age: { type: Number, min: 16, max: 120 },
    profileImageUrl: { type: String, trim: true, maxlength: 2048 },
    phone: { type: String, trim: true },
    gender: { type: String, enum: GENDER_OPTIONS.filter((g) => g !== 'any') },
    professionalType: { type: String, enum: PROFESSIONAL_TYPES },
    collegeOrCompanyName: { type: String, trim: true, maxlength: 200 },
    propertyOrPgName: { type: String, trim: true, maxlength: 200 },
    monthlyRent: { type: Number, min: 0 },
    securityDeposit: { type: Number, min: 0 },
    moveInDate: { type: Date },
    moveOutDate: { type: Date },
    roomPhotoUrls: [{ type: String, maxlength: 2048 }],
    description: { type: String, maxlength: 5000 },
    lifestyle: lifestyleSnippetSchema,
  },
  { _id: false },
);

const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, trim: true, maxlength: 200 },
    line2: { type: String, trim: true, maxlength: 200 },
    city: { type: String, trim: true, maxlength: 100 },
    state: { type: String, trim: true, maxlength: 100 },
    postalCode: { type: String, trim: true, maxlength: 20 },
    country: { type: String, trim: true, maxlength: 100, default: 'India' },
  },
  { _id: false },
);

const geoSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: {
      type: [Number],
      validate: {
        validator(v) {
          return Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number';
        },
        message: 'coordinates must be [longitude, latitude]',
      },
    },
    placeId: { type: String, trim: true },
    formattedAddress: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false },
);

const propertySchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    rentRange: {
      min: { type: Number, min: 0 },
      max: { type: Number, min: 0 },
    },
    currency: { type: String, default: 'INR', uppercase: true, maxlength: 3 },
    isVerified: { type: Boolean, default: false },
    listingType: { type: String, enum: LISTING_TYPES, required: true },
    coverImageUrl: { type: String, trim: true, maxlength: 2048 },
    imageUrls: [{ type: String, maxlength: 2048 }],
    offerText: { type: String, trim: true, maxlength: 500 },
    location: geoSchema,
    address: addressSchema,
    genderPreference: { type: String, enum: GENDER_OPTIONS, default: 'any' },
    description: { type: String, maxlength: 10000 },
    websiteUrl: { type: String, trim: true, maxlength: 2048 },
    socialLinks: {
      instagram: { type: String, trim: true, maxlength: 500 },
      facebook: { type: String, trim: true, maxlength: 500 },
      whatsapp: { type: String, trim: true, maxlength: 50 },
    },
    contactPhone: { type: String, trim: true },
    verificationBadge: { type: String, enum: ['none', 'id_verified', 'property_verified', 'premium'], default: 'none' },
    amenityIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Amenity' }],
    listerSnapshot: listerContextSchema,
    savedCount: { type: Number, default: 0, min: 0 },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true },
);

propertySchema.index({ location: '2dsphere' });
propertySchema.index({ listingType: 1, 'rentRange.min': 1 });
propertySchema.index({ owner: 1, createdAt: -1 });

module.exports = mongoose.model('Property', propertySchema);
