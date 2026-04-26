const Joi = require('joi');
const {
  USER_ROLES,
  PROFESSIONAL_TYPES,
  LISTING_TYPES,
  GENDER_OPTIONS,
} = require('../constants/roles');

const objectId = Joi.string().hex().length(24).required();

/**
 * Stored image references: absolute https URL (S3, CDN) or root-relative path (e.g. /images/...).
 * Protocol-relative URLs (//...) are rejected as open-redirect vectors.
 */
const imageUrlOptional = Joi.string()
  .trim()
  .max(2048)
  .allow('', null)
  .custom((value, helpers) => {
    if (value === '' || value == null) return value;
    if (value.startsWith('/') && !value.startsWith('//')) return value;
    const { error } = Joi.string().uri({ scheme: ['http', 'https'] }).validate(value);
    if (error) return helpers.error('any.invalid');
    return value;
  })
  .messages({
    'any.invalid': '{{#label}} must be a valid http(s) URL or a root-relative path starting with /',
  });

const imageUrlArrayItem = Joi.string()
  .trim()
  .min(1)
  .max(2048)
  .custom((value, helpers) => {
    if (value.startsWith('/') && !value.startsWith('//')) return value;
    const { error } = Joi.string().uri({ scheme: ['http', 'https'] }).validate(value);
    if (error) return helpers.error('any.invalid');
    return value;
  })
  .messages({
    'any.invalid': '{{#label}} must be a valid http(s) URL or a root-relative path starting with /',
  });

const lifestyle = Joi.object({
  diet: Joi.string().valid('vegetarian', 'non_vegetarian', 'eggetarian', 'vegan'),
  smoking: Joi.string().valid('non_smoker', 'smoker'),
  maritalStatus: Joi.string().valid('single', 'married', 'prefer_not_to_say'),
});

/** App profile edit — lifestyle chips (matches website `profile.schema`). */
const PROFILE_LIFESTYLE_TAGS = [
  'STUDENT',
  'WORKING',
  'VEGETARIAN',
  'NON_VEG',
  'SMOKER',
  'NON_SMOKER',
  'PET_FRIENDLY',
  'NIGHT_OWL',
  'EARLY_BIRD',
];

const lifestyleTagsPayload = Joi.object({
  tags: Joi.array().items(Joi.string().valid(...PROFILE_LIFESTYLE_TAGS)).max(20),
}).unknown(false);

/** Login email: relaxed TLD list so valid real-world addresses are not rejected before auth runs */
const loginEmail = Joi.string()
  .trim()
  .lowercase()
  .max(254)
  .email({ tlds: { allow: false }, allowUnicode: true, minDomainSegments: 1 })
  .required()
  .messages({
    'string.base': 'Email must be entered as text.',
    'string.empty': 'Email is required.',
    'any.required': 'Email is required.',
    'string.max': 'Email cannot be longer than 254 characters.',
    'string.email': 'Please enter a valid email address (for example, name@example.com).',
  });

const loginPassword = Joi.string()
  .required()
  .messages({
    'string.base': 'Password is required.',
    'string.empty': 'Password is required.',
    'any.required': 'Password is required.',
  });

exports.login = Joi.object({
  password: loginPassword,
  email: loginEmail,
});

exports.adminLogin = Joi.object({
  password: loginPassword,
  email: loginEmail,
});

exports.adminForgotPassword = Joi.object({
  email: loginEmail,
});

exports.adminResetPassword = Joi.object({
  token: Joi.string()
    .hex()
    .length(64)
    .required()
    .messages({
      'string.length': 'The reset link is invalid or has expired.',
      'string.hex': 'The reset link is invalid or has expired.',
      'any.required': 'Reset token is required.',
    }),
  newPassword: Joi.string().min(8).max(128).required().messages({
    'string.min': 'New password must be at least 8 characters long.',
    'string.max': 'New password is too long.',
    'any.required': 'New password is required.',
  }),
});

exports.adminUserListQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  role: Joi.string().valid(
    USER_ROLES.TENANT,
    USER_ROLES.OWNER,
    USER_ROLES.ROOMMATE,
    USER_ROLES.SUPERADMIN,
    USER_ROLES.SUB_ADMIN,
  ),
  search: Joi.string().trim().max(100).allow(''),
  isActive: Joi.string().valid('true', 'false'),
}).unknown(false);

/** Create sub-admin (only superadmin may call — enforced by requireSuperAdmin) */
exports.createAdminUser = Joi.object({
  fullName: Joi.string().trim().max(120).required(),
  email: loginEmail,
  password: Joi.string().min(8).max(128).required().messages({
    'string.min': 'Password must be at least 8 characters long.',
    'string.max': 'Password is too long.',
    'any.required': 'Password is required.',
    'string.empty': 'Password is required.',
  }),
}).unknown(false);

exports.paramAdminUserId = Joi.object({
  id: Joi.string().hex().length(24).required().messages({
    'string.hex': 'Invalid user id.',
    'string.length': 'Invalid user id.',
  }),
});

exports.adminUserIdentityReview = Joi.object({
  action: Joi.string().valid('verify', 'reject').required(),
  reason: Joi.string().trim().max(500).allow('', null),
}).unknown(false);

exports.adminUserPatch = Joi.object({
  isActive: Joi.boolean(),
})
  .min(1)
  .unknown(false)
  .messages({ 'object.min': 'Provide at least one field to update.' });

exports.updateProfile = Joi.object({
  fullName: Joi.string().trim().max(120),
  mobile: Joi.string().trim().pattern(/^[0-9+\s()-]{10,15}$/),
  professionalType: Joi.string().valid(...PROFESSIONAL_TYPES),
  lifestyle: Joi.alternatives().try(lifestyle, lifestyleTagsPayload),
  age: Joi.number().integer().min(16).max(120),
  gender: Joi.string().valid('male', 'female', 'other'),
  profileImageUrl: imageUrlOptional,
  bio: Joi.string().trim().max(2000).allow('', null),
  location: Joi.string().trim().max(200).allow('', null),
  monthlyBudget: Joi.number().integer().min(0).max(500000),
  moveInDate: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('', null),
  roommateGenderPreference: Joi.string().valid('any', 'male', 'female'),
})
  .min(1)
  .unknown(false)
  .messages({ 'object.min': 'Provide at least one field to update.' });

exports.changePassword = Joi.object({
  currentPassword: Joi.string().required().messages({
    'any.required': 'Current password is required.',
    'string.empty': 'Current password is required.',
  }),
  newPassword: Joi.string()
    .min(8)
    .max(128)
    .invalid(Joi.ref('currentPassword'))
    .required()
    .messages({
      'string.min': 'New password must be at least 8 characters long.',
      'string.max': 'New password is too long.',
      'any.required': 'New password is required.',
      'any.invalid': 'New password must be different from your current password.',
    }),
}).unknown(false);

/** One resident card on a property listing (API `listerSnapshots[]` or legacy `listerSnapshot`). */
const listerResidentBody = Joi.object({
  fullName: Joi.string().trim().max(120),
  age: Joi.number().min(16).max(120),
  profileImageUrl: imageUrlOptional,
  phone: Joi.string().trim(),
  gender: Joi.string().valid('male', 'female', 'other'),
  professionalType: Joi.string().valid(...PROFESSIONAL_TYPES),
  collegeOrCompanyName: Joi.string().trim().max(200),
  propertyOrPgName: Joi.string().trim().max(200),
  monthlyRent: Joi.number().min(0),
  securityDeposit: Joi.number().min(0),
  moveInDate: Joi.date(),
  moveOutDate: Joi.date(),
  roomPhotoUrls: Joi.array().items(imageUrlArrayItem).max(20),
  description: Joi.string().max(5000).allow('', null),
  lifestyle: Joi.object({
    diet: Joi.string().valid('vegetarian', 'non_vegetarian', 'eggetarian', 'vegan'),
    smoking: Joi.string().valid('non_smoker', 'smoker'),
  }).optional(),
});

exports.register = Joi.object({
  fullName: Joi.string().trim().max(120).required(),
  mobile: Joi.string().trim().pattern(/^[0-9+\s()-]{10,15}$/).required(),
  email: Joi.string().trim().email().max(254).required(),
  role: Joi.string().valid(USER_ROLES.TENANT, USER_ROLES.OWNER, USER_ROLES.ROOMMATE).required(),
  password: Joi.string().min(8).max(128).required(),
  professionalType: Joi.string()
    .valid(...PROFESSIONAL_TYPES)
    .required(),
  lifestyle: lifestyle.optional(),
  age: Joi.number().integer().min(16).max(120),
  gender: Joi.string().valid('male', 'female', 'other'),
  profileImageUrl: imageUrlOptional,
});

exports.createProperty = Joi.object({
  title: Joi.string().trim().min(3).max(200).required().messages({
    'string.min': 'Title must be at least 3 characters long.',
    'string.empty': 'Title is required.',
  }),
  rentRange: Joi.object({
    min: Joi.number().min(0).required(),
    max: Joi.number().min(0),
  })
    .required()
    .messages({ 'any.required': 'Rent information is required.' }),
  currency: Joi.string().uppercase().length(3).optional(),
  listingType: Joi.string()
    .valid(...LISTING_TYPES)
    .required(),
  coverImageUrl: imageUrlOptional,
  imageUrls: Joi.array().items(imageUrlArrayItem).max(30),
  offerText: Joi.string().trim().max(500).allow('', null),
  location: Joi.object({
    type: Joi.string().valid('Point'),
    coordinates: Joi.array().items(Joi.number()).length(2).required(),
    placeId: Joi.string().trim(),
    formattedAddress: Joi.string().trim().max(500),
  }).optional(),
  address: Joi.object({
    line1: Joi.string().trim().min(3).max(200),
    line2: Joi.string().trim().max(200).allow('', null),
    city: Joi.string().trim().min(2).max(100),
    state: Joi.string().trim().min(2).max(100),
    postalCode: Joi.string().trim().max(20).allow('', null),
    country: Joi.string().trim().min(2).max(100),
  }).optional(),
  genderPreference: Joi.string().valid(...GENDER_OPTIONS),
  description: Joi.string().max(10000).allow('', null),
  websiteUrl: Joi.string().uri().max(2048).allow('', null),
  socialLinks: Joi.object({
    instagram: Joi.string().trim().max(500).allow('', null),
    facebook: Joi.string().trim().max(500).allow('', null),
    whatsapp: Joi.string().trim().max(50).allow('', null),
  }).optional(),
  contactPhone: Joi.string().trim().max(20),
  verificationBadge: Joi.string().valid('none', 'id_verified', 'property_verified', 'premium'),
  amenityIds: Joi.array().items(Joi.string().hex().length(24)).max(50),
  availableSpots: Joi.number().integer().min(1).max(50),
  listerSnapshot: listerResidentBody.optional(),
  listerSnapshots: Joi.array().items(listerResidentBody).max(20),
  isPublished: Joi.boolean(),
});

exports.moderateProperty = Joi.object({
  action: Joi.string().valid('approve', 'reject', 'under_review').required(),
  reason: Joi.when('action', {
    is: 'reject',
    then: Joi.string()
      .trim()
      .min(3)
      .max(2000)
      .required()
      .messages({
        'string.empty': 'Please provide a rejection reason.',
        'string.min': 'Rejection reason must be at least 3 characters.',
        'any.required': 'Rejection reason is required when rejecting a listing.',
      }),
    otherwise: Joi.string().trim().max(2000).allow('', null),
  }),
}).unknown(false);

exports.updateProperty = Joi.object({
  title: Joi.string().trim().min(3).max(200).messages({
    'string.min': 'Title must be at least 3 characters long.',
  }),
  rentRange: Joi.object({
    min: Joi.number().min(0),
    max: Joi.number().min(0),
  }),
  currency: Joi.string().uppercase().length(3),
  listingType: Joi.string().valid(...LISTING_TYPES),
  coverImageUrl: imageUrlOptional,
  imageUrls: Joi.array().items(imageUrlArrayItem).max(30),
  offerText: Joi.string().trim().max(500).allow('', null),
  location: Joi.object({
    type: Joi.string().valid('Point'),
    coordinates: Joi.array().items(Joi.number()).length(2).required(),
    placeId: Joi.string().trim(),
    formattedAddress: Joi.string().trim().max(500),
  }),
  address: Joi.object({
    line1: Joi.string().trim().min(3).max(200),
    line2: Joi.string().trim().max(200).allow('', null),
    city: Joi.string().trim().min(2).max(100),
    state: Joi.string().trim().min(2).max(100),
    postalCode: Joi.string().trim().max(20).allow('', null),
    country: Joi.string().trim().min(2).max(100),
  }),
  genderPreference: Joi.string().valid(...GENDER_OPTIONS),
  description: Joi.string().max(10000).allow('', null),
  websiteUrl: Joi.string().uri().max(2048).allow('', null),
  socialLinks: Joi.object({
    instagram: Joi.string().trim().max(500).allow('', null),
    facebook: Joi.string().trim().max(500).allow('', null),
    whatsapp: Joi.string().trim().max(50).allow('', null),
  }),
  contactPhone: Joi.string().trim().max(20),
  verificationBadge: Joi.string().valid('none', 'id_verified', 'property_verified', 'premium'),
  amenityIds: Joi.array().items(Joi.string().hex().length(24)).max(50),
  availableSpots: Joi.number().integer().min(1).max(50),
  listerSnapshot: listerResidentBody,
  listerSnapshots: Joi.array().items(listerResidentBody).max(20),
  isPublished: Joi.boolean(),
})
  .min(1)
  .messages({ 'object.min': 'At least one field is required to update' });

exports.createBooking = Joi.object({
  propertyId: objectId,
  preferredDate: Joi.date().required(),
  preferredTimeStart: Joi.string().trim().max(10).allow('', null),
  preferredTimeEnd: Joi.string().trim().max(10).allow('', null),
  contactName: Joi.string().trim().max(120).required(),
  contactPhone: Joi.string().trim().max(20).required(),
  notes: Joi.string().max(2000).allow('', null),
});

exports.createAmenity = Joi.object({
  iconKey: Joi.string().trim().max(64),
  iconUrl: Joi.string().uri().max(2048).allow('', null),
  name: Joi.string().trim().max(100).required(),
  slug: Joi.string().trim().lowercase().max(120),
});

exports.updateAmenity = Joi.object({
  iconKey: Joi.string().trim().max(64),
  iconUrl: Joi.string().uri().max(2048).allow('', null),
  name: Joi.string().trim().max(100),
  slug: Joi.string().trim().lowercase().max(120),
  isActive: Joi.boolean(),
})
  .min(1)
  .messages({ 'object.min': 'At least one field is required' });

exports.createFaq = Joi.object({
  question: Joi.string().trim().max(500).required(),
  answer: Joi.string().max(10000).required(),
  order: Joi.number().integer().min(0),
  isPublished: Joi.boolean(),
});

exports.updateFaq = Joi.object({
  question: Joi.string().trim().max(500),
  answer: Joi.string().max(10000),
  order: Joi.number().integer().min(0),
  isPublished: Joi.boolean(),
})
  .min(1)
  .messages({ 'object.min': 'At least one field is required' });

exports.createSupport = Joi.object({
  issueTitle: Joi.string().trim().max(200).required(),
  description: Joi.string().max(8000).allow('', null),
  priority: Joi.string().valid('low', 'medium', 'high'),
});

exports.sendChat = Joi.object({
  receiverId: Joi.string().hex().length(24).required(),
  message: Joi.string().trim().min(1).max(8000).required(),
});

exports.createNotification = Joi.object({
  userId: objectId,
  title: Joi.string().trim().max(200).required(),
  description: Joi.string().max(2000).allow('', null),
  type: Joi.string().valid('booking', 'message', 'listing', 'system', 'payment', 'promo').required(),
  payload: Joi.object().unknown(true),
});

exports.paramId = Joi.object({
  id: Joi.string().hex().length(24).required(),
});

/** `GET|PATCH|DELETE .../properties/:id/lister-residents/:residentId` */
exports.paramPropertyResident = Joi.object({
  id: Joi.string().hex().length(24).required(),
  residentId: Joi.string().hex().length(24).required(),
});

/** POST one resident — same field rules as embedded lister row. */
exports.listerResidentPostBody = listerResidentBody;

/** PATCH one resident — partial update (at least one field recommended; enforced in controller if needed). */
exports.patchListerResidentBody = listerResidentBody;

exports.paramPropertyId = Joi.object({
  propertyId: Joi.string().hex().length(24).required(),
});

exports.paramUserId = Joi.object({
  userId: Joi.string().hex().length(24).required(),
});

exports.updateBookingStatus = Joi.object({
  status: Joi.string().valid('pending', 'confirmed', 'cancelled', 'completed').required(),
  notes: Joi.string().max(2000).allow('', null),
});

exports.patchSupport = Joi.object({
  status: Joi.string().valid('open', 'in_progress', 'resolved', 'closed'),
  description: Joi.string().max(8000).allow('', null),
})
  .min(1)
  .messages({ 'object.min': 'Provide at least one field' });

const TENANT_ROOMMATE_LIFESTYLE_TAGS = [
  'Non-Smoker',
  'Vegetarian',
  'Non-Veg',
  'Early Bird',
  'Night Owl',
  'Pet Friendly',
  'Working',
  'Student',
];

/** Mongo seeker profile `_id`, or synthetic `user-<userId>` when listing from main `User` only. */
exports.tenantRoommateProfileParamId = Joi.object({
  id: Joi.alternatives()
    .try(Joi.string().hex().length(24), Joi.string().pattern(/^user-[a-fA-F0-9]{24}$/i))
    .required(),
});

exports.tenantRoommateProfileListQuery = Joi.object({
  search: Joi.string().trim().max(200).allow(''),
  tags: Joi.string().trim().max(500).allow(''),
  /** `all` = profile must include every tag; `any` = profile includes at least one (better for personalized home feed). */
  tagsMatch: Joi.string().valid('all', 'any'),
  /** When set, only profiles whose monthlyBudget falls in a band around this value (seeker budget). */
  budget: Joi.number().integer().min(0).max(500000),
}).unknown(false);

exports.tenantRoommateProfileUpsert = Joi.object({
  displayName: Joi.string().trim().min(2).max(120).required(),
  occupation: Joi.string().trim().min(2).max(120).required(),
  location: Joi.string().trim().min(3).max(200).required(),
  monthlyBudget: Joi.number().integer().min(1000).max(500000).required(),
  moveInDate: Joi.date().required(),
  bio: Joi.string().trim().min(20).max(2000).required(),
  lifestyleTags: Joi.array()
    .items(Joi.string().valid(...TENANT_ROOMMATE_LIFESTYLE_TAGS))
    .min(1)
    .max(10)
    .required(),
  displayRole: Joi.string().valid('Student', 'Working', 'Veg Only').required(),
}).unknown(false);
