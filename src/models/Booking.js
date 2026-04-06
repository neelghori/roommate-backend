const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    preferredDate: { type: Date, required: true },
    preferredTimeStart: { type: String, trim: true, maxlength: 10 },
    preferredTimeEnd: { type: String, trim: true, maxlength: 10 },
    contactName: { type: String, required: true, trim: true, maxlength: 120 },
    contactPhone: { type: String, required: true, trim: true, maxlength: 20 },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed'],
      default: 'pending',
    },
    notes: { type: String, maxlength: 2000 },
  },
  { timestamps: true },
);

bookingSchema.index({ property: 1, preferredDate: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
