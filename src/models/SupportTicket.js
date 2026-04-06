const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema(
  {
    issueTitle: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 8000 },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved', 'closed'],
      default: 'open',
    },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  },
  { timestamps: true },
);

supportTicketSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
