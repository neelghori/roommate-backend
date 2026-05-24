const mongoose = require('mongoose');
const Property = require('../models/Property');
const SavedProperty = require('../models/SavedProperty');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const PushSubscription = require('../models/PushSubscription');
const ChatMessage = require('../models/ChatMessage');
const TenantRoommateProfile = require('../models/TenantRoommateProfile');
const SupportTicket = require('../models/SupportTicket');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { USER_ROLES } = require('../constants/roles');
const { deleteObjectsByUrls } = require('./s3Upload');

function collectAllPropertyImageUrls(doc) {
  const urls = [];
  const cover = typeof doc.coverImageUrl === 'string' ? doc.coverImageUrl.trim() : '';
  if (cover) urls.push(cover);
  if (Array.isArray(doc.imageUrls)) {
    for (const u of doc.imageUrls) {
      if (typeof u === 'string' && u.trim()) urls.push(u.trim());
    }
  }

  const addResident = (r) => {
    if (!r || typeof r !== 'object') return;
    if (typeof r.profileImageUrl === 'string' && r.profileImageUrl.trim()) {
      urls.push(r.profileImageUrl.trim());
    }
    if (Array.isArray(r.roomPhotoUrls)) {
      for (const u of r.roomPhotoUrls) {
        if (typeof u === 'string' && u.trim()) urls.push(u.trim());
      }
    }
  };

  if (Array.isArray(doc.listerSnapshots)) {
    for (const row of doc.listerSnapshots) {
      addResident(row.toObject ? row.toObject() : row);
    }
  }
  if (doc.listerSnapshot) {
    addResident(doc.listerSnapshot.toObject ? doc.listerSnapshot.toObject() : doc.listerSnapshot);
  }

  return [...new Set(urls)];
}

function collectUserMediaUrls(user) {
  const urls = [];
  if (typeof user.profileImageUrl === 'string' && user.profileImageUrl.trim()) {
    urls.push(user.profileImageUrl.trim());
  }
  if (typeof user.identityDocumentUrl === 'string' && user.identityDocumentUrl.trim()) {
    urls.push(user.identityDocumentUrl.trim());
  }
  return urls;
}

/**
 * Permanently remove a listing and related rows (not soft delete).
 * @returns {Promise<boolean>} false if property not found
 */
async function hardDeletePropertyById(propertyId) {
  if (!mongoose.Types.ObjectId.isValid(propertyId)) return false;

  const doc = await Property.findById(propertyId);
  if (!doc) return false;

  const urls = collectAllPropertyImageUrls(doc);
  const pid = doc._id;
  const pidStr = String(pid);

  await Promise.all([
    SavedProperty.deleteMany({ property: pid }),
    Booking.deleteMany({ property: pid }),
    Notification.deleteMany({
      $or: [{ 'payload.propertyId': pidStr }, { 'payload.propertyId': pid }],
    }),
  ]);

  await doc.deleteOne();
  if (urls.length) await deleteObjectsByUrls(urls);

  return true;
}

/**
 * Permanently remove a user and owned listings / related data (not soft delete).
 */
async function hardDeleteUserById(userId, options = {}) {
  const { requesterId } = options;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, 'Invalid user id');
  }

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');

  if (requesterId && user._id.equals(requesterId)) {
    throw new ApiError(400, 'You cannot delete your own account.');
  }

  if (user.role === USER_ROLES.SUPERADMIN) {
    throw new ApiError(400, 'Super admin accounts cannot be deleted.');
  }

  const uid = user._id;
  const owned = await Property.find({ owner: uid }).select('_id').lean();

  for (const row of owned) {
    await hardDeletePropertyById(row._id);
  }

  const mediaUrls = collectUserMediaUrls(user);

  await Promise.all([
    SavedProperty.deleteMany({ user: uid }),
    Booking.deleteMany({ requester: uid }),
    ChatMessage.deleteMany({ $or: [{ sender: uid }, { receiver: uid }] }),
    Notification.deleteMany({ user: uid }),
    PushSubscription.deleteMany({ user: uid }),
    TenantRoommateProfile.deleteMany({ user: uid }),
    SupportTicket.deleteMany({ user: uid }),
    User.updateMany(
      { identityReviewedBy: uid },
      { $unset: { identityReviewedBy: 1, identityReviewedAt: 1 } },
    ),
  ]);

  await user.deleteOne();
  if (mediaUrls.length) await deleteObjectsByUrls(mediaUrls);
}

module.exports = {
  collectAllPropertyImageUrls,
  hardDeletePropertyById,
  hardDeleteUserById,
};
