const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    message: { type: String, required: true, maxlength: 8000, trim: true },
    readAt: { type: Date },
  },
  { timestamps: true },
);

chatMessageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
