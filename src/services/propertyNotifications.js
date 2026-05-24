const User = require('../models/User');
const Notification = require('../models/Notification');
const { USER_ROLES } = require('../constants/roles');
const { deliverNotification } = require('./notificationDelivery');

/**
 * In-app notifications for listing lifecycle (best-effort; errors are logged).
 */

async function notifyStaffNewPropertyListing(property) {
  const title = String(property.title || 'Untitled listing').slice(0, 120);

  const staffRows = await User.find({
    isActive: true,
    $or: [
      { role: { $in: [USER_ROLES.SUPERADMIN, USER_ROLES.SUB_ADMIN] } },
      { isStaff: true },
    ],
  })
    .select('_id role')
    .lean();

  const seen = new Set();
  const staff = staffRows.filter((row) => {
    const id = String(row._id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  if (!staff.length) {
    // eslint-disable-next-line no-console
    console.warn(
      '[propertyNotifications] No staff users (superadmin/sub_admin or isStaff). Create an admin user so new-listing alerts can be stored.',
    );
    return;
  }

  const description = `"${title}" was submitted and is pending your review.`;
  const payload = {
    kind: 'new_listing_pending',
    propertyId: String(property._id),
    title,
  };

  const docs = await Promise.all(
    staff.map((row) =>
      Notification.create({
        user: row._id,
        title: 'New property pending approval',
        description,
        type: 'listing',
        payload,
      }),
    ),
  );
  for (const doc of docs) {
    deliverNotification(doc.user, doc).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[propertyNotifications] deliver failed:', err?.message || err);
    });
  }
}

async function notifyOwnerListingApproved(property) {
  const ownerId = property.owner?._id ?? property.owner;
  if (!ownerId) {
    // eslint-disable-next-line no-console
    console.warn('[propertyNotifications] notifyOwnerListingApproved: missing owner on property', property._id);
    return;
  }

  const title = String(property.title || 'Your listing').slice(0, 120);
  const doc = await Notification.create({
    user: ownerId,
    title: 'Your listing is live',
    description: `"${title}" has been approved and is now listed for seekers to discover.`,
    type: 'listing',
    payload: {
      kind: 'listing_approved',
      propertyId: String(property._id),
      title,
    },
  });
  deliverNotification(ownerId, doc).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[propertyNotifications] deliver failed:', err?.message || err);
  });
}

async function notifyOwnerListingRejected(property) {
  const ownerId = property.owner?._id ?? property.owner;
  if (!ownerId) {
    // eslint-disable-next-line no-console
    console.warn('[propertyNotifications] notifyOwnerListingRejected: missing owner on property', property._id);
    return;
  }

  const title = String(property.title || 'Your listing').slice(0, 120);
  const reason = String(property.rejectionReason || 'Rejected by moderator.').trim().slice(0, 800);
  const doc = await Notification.create({
    user: ownerId,
    title: 'Your listing was not approved',
    description: `"${title}" was reviewed and not published. Reason: ${reason}`,
    type: 'listing',
    payload: {
      kind: 'listing_rejected',
      propertyId: String(property._id),
      title,
      rejectionReason: reason,
    },
  });
  deliverNotification(ownerId, doc).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[propertyNotifications] deliver failed:', err?.message || err);
  });
}

module.exports = {
  notifyStaffNewPropertyListing,
  notifyOwnerListingApproved,
  notifyOwnerListingRejected,
};
