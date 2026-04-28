const Booking = require('../models/Booking');
const catchAsync = require('../utils/catchAsync');

function pickPropertyImage(p) {
  if (!p) return null;
  const cover = typeof p.coverImageUrl === 'string' ? p.coverImageUrl.trim() : '';
  const urls = Array.isArray(p.imageUrls) ? p.imageUrls.map((u) => (typeof u === 'string' ? u.trim() : '')).filter(Boolean) : [];
  const candidates = [cover, ...urls].filter(Boolean);
  const http = candidates.find((u) => /^https?:\/\//i.test(u) || u.startsWith('//'));
  return http || candidates[0] || null;
}

function formatPropertyLocation(p) {
  if (!p) return '';
  const fa = p.location && typeof p.location.formattedAddress === 'string' ? p.location.formattedAddress.trim() : '';
  if (fa) return fa;
  const a = p.address || {};
  return [a.line1, a.line2, a.city, a.state].filter((x) => typeof x === 'string' && x.trim()).join(', ');
}

function mapOwner(o) {
  if (!o || typeof o !== 'object') return null;
  const id = o._id != null ? String(o._id) : null;
  if (!id) return null;
  return {
    id,
    fullName: o.fullName ?? '—',
    email: o.email ?? '',
    mobile: o.mobile ?? '',
  };
}

function mapRequester(u) {
  if (!u || typeof u !== 'object') return null;
  const id = u._id != null ? String(u._id) : null;
  if (!id) return null;
  return {
    id,
    fullName: u.fullName ?? '—',
    email: u.email ?? '',
    mobile: u.mobile ?? '',
    role: u.role ?? '',
  };
}

function mapProperty(prop) {
  if (!prop || typeof prop !== 'object') return null;
  const id = prop._id != null ? String(prop._id) : null;
  if (!id) return null;
  return {
    id,
    title: prop.title ?? 'Untitled',
    listingType: prop.listingType ?? '',
    imageUrl: pickPropertyImage(prop),
    locationLabel: formatPropertyLocation(prop),
    rentMin: prop.rentRange && typeof prop.rentRange.min === 'number' ? prop.rentRange.min : null,
    moderationStatus: prop.moderationStatus ?? null,
    isPublished: typeof prop.isPublished === 'boolean' ? prop.isPublished : null,
    owner: mapOwner(prop.owner),
  };
}

function mapBookingAdmin(b) {
  const preferredDate =
    b.preferredDate instanceof Date ? b.preferredDate.toISOString() : b.preferredDate ? String(b.preferredDate) : '';
  const createdAt = b.createdAt instanceof Date ? b.createdAt.toISOString() : b.createdAt ? String(b.createdAt) : '';
  const updatedAt = b.updatedAt instanceof Date ? b.updatedAt.toISOString() : b.updatedAt ? String(b.updatedAt) : '';

  return {
    id: String(b._id),
    status: b.status ?? 'pending',
    preferredDate,
    preferredTimeStart: b.preferredTimeStart || null,
    preferredTimeEnd: b.preferredTimeEnd || null,
    contactName: b.contactName ?? '',
    contactPhone: b.contactPhone ?? '',
    notes: b.notes || null,
    createdAt,
    updatedAt,
    requester: mapRequester(b.requester),
    property: mapProperty(b.property),
  };
}

/** All visit bookings with requester + property (and property owner) for admin review. */
exports.list = catchAsync(async (req, res) => {
  const items = await Booking.find({})
    .sort({ createdAt: -1 })
    .limit(500)
    .populate({
      path: 'property',
      select:
        'title coverImageUrl imageUrls listingType address location rentRange moderationStatus isPublished owner',
      populate: { path: 'owner', select: 'fullName email mobile' },
    })
    .populate('requester', 'fullName email mobile role')
    .lean();

  res.json({
    status: 'ok',
    data: { items: items.map(mapBookingAdmin) },
  });
});
