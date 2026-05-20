const mongoose = require('mongoose');
const Property = require('../models/Property');
const User = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { USER_ROLES } = require('../constants/roles');
const { isS3Configured, putImageObject, randomImageObjectName } = require('../services/s3Upload');

function requireS3() {
  if (!isS3Configured()) {
    throw new ApiError(503, 'Image uploads are not configured. Set AWS_S3_BUCKET and AWS_REGION (and credentials if needed).');
  }
}

async function assertPropertyOwner(propertyId, userId) {
  if (!mongoose.Types.ObjectId.isValid(propertyId)) throw new ApiError(400, 'Invalid listing id');
  const doc = await Property.findById(propertyId).select('owner');
  if (!doc) throw new ApiError(404, 'Listing not found');
  if (!doc.owner.equals(userId)) throw new ApiError(403, 'You can only upload images for your own listings');
}

/** POST multipart `images` (max 10) → `properties/{propertyId}/...` */
exports.uploadPropertyGallery = catchAsync(async (req, res) => {
  requireS3();
  const { propertyId } = req.params;
  await assertPropertyOwner(propertyId, req.user._id);

  const files = req.files || [];
  if (!files.length) throw new ApiError(400, 'No image files received (use field name "images")');

  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.log(
      `[upload] gallery property=${propertyId} files=${files.length} sizes=${files.map((f) => f.size).join(',')}`,
    );
  }

  const urls = [];
  for (const f of files) {
    const key = `properties/${propertyId}/${randomImageObjectName(f.mimetype)}`;
    try {
      const url = await putImageObject(key, f.buffer, f.mimetype);
      urls.push(url);
    } catch (e) {
      if (e.code === 'S3_NOT_CONFIGURED') throw new ApiError(503, 'S3 is not configured');
      throw e;
    }
  }

  res.status(201).json({ status: 'ok', data: { urls } });
});

/** POST multipart `image` (single) → `profiles/residents/{propertyId}/...` */
exports.uploadResidentProfileImage = catchAsync(async (req, res) => {
  requireS3();
  const { propertyId } = req.params;
  await assertPropertyOwner(propertyId, req.user._id);

  const f = req.file;
  if (!f) throw new ApiError(400, 'No image file received (use field name "image")');

  const key = `profiles/residents/${propertyId}/${randomImageObjectName(f.mimetype)}`;
  try {
    const url = await putImageObject(key, f.buffer, f.mimetype);
    res.status(201).json({ status: 'ok', data: { url } });
  } catch (e) {
    if (e.code === 'S3_NOT_CONFIGURED') throw new ApiError(503, 'S3 is not configured');
    throw e;
  }
});

/** POST multipart `image` (single) → `profiles/users/{userId}/...` */
exports.uploadUserAvatar = catchAsync(async (req, res) => {
  requireS3();
  const f = req.file;
  if (!f) throw new ApiError(400, 'No image file received (use field name "image")');

  const uid = req.user._id.toString();
  const key = `profiles/users/${uid}/${randomImageObjectName(f.mimetype)}`;
  try {
    const url = await putImageObject(key, f.buffer, f.mimetype);
    res.status(201).json({ status: 'ok', data: { url } });
  } catch (e) {
    if (e.code === 'S3_NOT_CONFIGURED') throw new ApiError(503, 'S3 is not configured');
    throw e;
  }
});

/** POST multipart `document` — government ID for identity verification (tenant/owner/roommate). */
exports.uploadUserIdentityDocument = catchAsync(async (req, res) => {
  requireS3();
  const f = req.file;
  if (!f) throw new ApiError(400, 'No file received (use field name "document")');

  const role = req.user.role;
  if (
    role === USER_ROLES.SUPERADMIN ||
    role === USER_ROLES.SUB_ADMIN
  ) {
    throw new ApiError(403, 'Identity verification is not required for admin accounts.');
  }

  const user = await User.findById(req.user._id);
  if (!user) throw new ApiError(404, 'User not found');
  if (user.identityVerificationStatus === 'verified') {
    throw new ApiError(400, 'Your identity is already verified.');
  }

  const uid = req.user._id.toString();
  const key = `profiles/users/${uid}/identity/${randomImageObjectName(f.mimetype)}`;
  try {
    const url = await putImageObject(key, f.buffer, f.mimetype);
    user.identityDocumentUrl = url;
    user.identityVerificationStatus = 'pending';
    user.identitySubmittedAt = new Date();
    user.identityRejectionReason = undefined;
    user.identityReviewedAt = undefined;
    user.identityReviewedBy = undefined;
    await user.save({ validateBeforeSave: false });
    res.status(201).json({
      status: 'ok',
      data: {
        url,
        identityVerificationStatus: user.identityVerificationStatus,
        identitySubmittedAt: user.identitySubmittedAt,
      },
    });
  } catch (e) {
    if (e.code === 'S3_NOT_CONFIGURED') throw new ApiError(503, 'S3 is not configured');
    throw e;
  }
});
