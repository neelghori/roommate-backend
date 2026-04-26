const Property = require('../models/Property');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const {
  notifyOwnerListingApproved,
  notifyOwnerListingRejected,
} = require('../services/propertyNotifications');

const TYPE_DISPLAY = {
  pg: 'PG',
  flat: 'Flat',
  room: 'Rent',
  roommate_seeker: 'Roommate',
};

function mapToAdminRow(p) {
  const owner = p.owner;
  const ownerName = owner?.fullName ?? 'Unknown';
  const ownerEmail = owner?.email ?? '';
  const min = p.rentRange?.min ?? 0;
  const city = p.address?.city ?? '';
  const status =
    p.moderationStatus === 'rejected'
      ? 'REJECTED'
      : p.moderationStatus === 'under_review'
        ? 'UNDER_REVIEW'
        : p.moderationStatus === 'approved' && p.isPublished
          ? 'APPROVED'
          : 'PENDING';

  const createdAt =
    p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt ? String(p.createdAt) : '';

  return {
    id: String(p._id),
    title: p.title,
    ownerName,
    ownerEmail,
    type: TYPE_DISPLAY[p.listingType] || p.listingType,
    listingType: p.listingType,
    city,
    price: min,
    status,
    createdAt,
    flagCount: 0,
    moderationStatus: p.moderationStatus,
    isPublished: p.isPublished,
    rejectionReason: p.rejectionReason ?? '',
  };
}

exports.list = catchAsync(async (req, res) => {
  const { status } = req.query;
  const filter = {};
  if (status === 'queue') {
    filter.$or = [{ moderationStatus: 'pending' }, { moderationStatus: 'under_review' }];
  } else if (status === 'pending') {
    filter.moderationStatus = 'pending';
  } else if (status === 'under_review') {
    filter.moderationStatus = 'under_review';
  } else if (status === 'approved') {
    filter.moderationStatus = 'approved';
    filter.isPublished = true;
  } else if (status === 'rejected') {
    filter.moderationStatus = 'rejected';
  }

  const items = await Property.find(filter)
    .sort({ createdAt: -1 })
    .limit(200)
    .populate('owner', 'fullName email')
    .lean();

  res.json({
    status: 'ok',
    data: { items: items.map(mapToAdminRow) },
  });
});

exports.getOne = catchAsync(async (req, res) => {
  const doc = await Property.findById(req.params.id)
    .populate('owner', 'fullName email mobile role')
    .populate('amenityIds')
    .lean();
  if (!doc) throw new ApiError(404, 'Listing not found');
  res.json({ status: 'ok', data: { property: doc, summary: mapToAdminRow({ ...doc, owner: doc.owner }) } });
});

exports.moderate = catchAsync(async (req, res) => {
  const { action, reason } = req.body;
  const doc = await Property.findById(req.params.id);
  if (!doc) throw new ApiError(404, 'Listing not found');

  const ownerShouldReceiveApprovalNotice =
    action === 'approve' &&
    !(doc.moderationStatus === 'approved' && doc.isPublished === true);

  const prevModeration = doc.moderationStatus;
  const ownerShouldReceiveRejectionNotice =
    action === 'reject' && prevModeration !== 'rejected';

  if (action === 'approve') {
    doc.isPublished = true;
    doc.moderationStatus = 'approved';
    doc.rejectionReason = undefined;
  } else if (action === 'reject') {
    doc.isPublished = false;
    doc.moderationStatus = 'rejected';
    doc.rejectionReason = reason?.trim() || 'Rejected by moderator.';
  } else if (action === 'under_review') {
    doc.isPublished = false;
    doc.moderationStatus = 'under_review';
    doc.rejectionReason = undefined;
  }

  await doc.save();

  if (ownerShouldReceiveApprovalNotice) {
    notifyOwnerListingApproved(doc).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[adminPropertyController.moderate] notifyOwnerListingApproved:', err?.message || err);
    });
  }

  if (ownerShouldReceiveRejectionNotice) {
    notifyOwnerListingRejected(doc).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[adminPropertyController.moderate] notifyOwnerListingRejected:', err?.message || err);
    });
  }

  const lean = await Property.findById(doc._id).populate('owner', 'fullName email').lean();
  res.json({ status: 'ok', data: { listing: mapToAdminRow(lean) } });
});
