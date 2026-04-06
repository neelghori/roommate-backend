const SupportTicket = require('../models/SupportTicket');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');

exports.create = catchAsync(async (req, res) => {
  const doc = await SupportTicket.create({
    issueTitle: req.body.issueTitle,
    description: req.body.description,
    user: req.user._id,
    priority: req.body.priority,
  });
  res.status(201).json({ status: 'ok', data: { ticket: doc } });
});

exports.myTickets = catchAsync(async (req, res) => {
  const items = await SupportTicket.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ status: 'ok', data: { items } });
});

exports.update = catchAsync(async (req, res) => {
  const ticket = await SupportTicket.findById(req.params.id);
  if (!ticket) throw new ApiError(404, 'Ticket not found');

  const isOwner = ticket.user.equals(req.user._id);
  if (!isOwner && !req.user.isStaff) throw new ApiError(403, 'Not allowed');

  if (req.user.isStaff && req.body.status) {
    ticket.status = req.body.status;
    if (req.body.status === 'resolved' || req.body.status === 'closed') {
      ticket.resolvedBy = req.user._id;
    }
  } else if (isOwner && req.body.description != null) {
    ticket.description = req.body.description;
  }

  await ticket.save();
  res.json({ status: 'ok', data: { ticket } });
});
