const mongoose = require('mongoose');

const amenitySchema = new mongoose.Schema(
  {
    iconKey: { type: String, trim: true, maxlength: 64 },
    iconUrl: { type: String, trim: true, maxlength: 2048 },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, trim: true, lowercase: true, maxlength: 120 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

amenitySchema.index({ name: 1 });
amenitySchema.index({ slug: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Amenity', amenitySchema);
