const Joi = require('joi');
const {
  USER_ROLES,
  PROFESSIONAL_TYPES,
  LISTING_TYPES,
  GENDER_OPTIONS,
} = require('../constants/roles');

const objectId = Joi.string().hex().length(24).required();

const lifestyle = Joi.object({
  diet: Joi.string().valid('vegetarian', 'non_vegetarian', 'eggetarian', 'vegan'),
  smoking: Joi.string().valid('non_smoker', 'smoker'),
  maritalStatus: Joi.string().valid('single', 'married', 'prefer_not_to_say'),
});

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

exports.updateProfile = Joi.object({
  fullName: Joi.string().trim().max(120),
  mobile: Joi.string().trim().pattern(/^[0-9+\s()-]{10,15}$/),
  professionalType: Joi.string().valid(...PROFESSIONAL_TYPES),
  lifestyle: lifestyle.optional(),
  age: Joi.number().integer().min(16).max(120),
  gender: Joi.string().valid('male', 'female', 'other'),
  profileImageUrl: Joi.string().uri().max(2048).allow('', null),
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

exports.register = Joi.object({
  fullName: Joi.string().trim().max(120).required(),
  mobile: Joi.string().trim().pattern(/^[0-9+\s()-]{10,15}$/).required(),
  email: Joi.string().trim().email().max(254).required(),
  role: Joi.string().valid(USER_ROLES.TENANT, USER_ROLES.OWNER).required(),
  password: Joi.string().min(8).max(128).required(),
  professionalType: Joi.string()
    .valid(...PROFESSIONAL_TYPES)
    .required(),
  lifestyle: lifestyle.optional(),
  age: Joi.number().integer().min(16).max(120),
  gender: Joi.string().valid('male', 'female', 'other'),
  profileImageUrl: Joi.string().uri().max(2048).allow('', null),
});

exports.createProperty = Joi.object({
  title: Joi.string().trim().max(200).required(),
  rentRange: Joi.object({
    min: Joi.number().min(0),
    max: Joi.number().min(0),
  }).optional(),
  currency: Joi.string().uppercase().length(3).optional(),
  listingType: Joi.string()
    .valid(...LISTING_TYPES)
    .required(),
  coverImageUrl: Joi.string().uri().max(2048).allow('', null),
  imageUrls: Joi.array().items(Joi.string().uri().max(2048)).max(30),
  offerText: Joi.string().trim().max(500).allow('', null),
  location: Joi.object({
    type: Joi.string().valid('Point'),
    coordinates: Joi.array().items(Joi.number()).length(2).required(),
    placeId: Joi.string().trim(),
    formattedAddress: Joi.string().trim().max(500),
  }).optional(),
  address: Joi.object({
    line1: Joi.string().trim().max(200),
    line2: Joi.string().trim().max(200),
    city: Joi.string().trim().max(100),
    state: Joi.string().trim().max(100),
    postalCode: Joi.string().trim().max(20),
    country: Joi.string().trim().max(100),
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
  listerSnapshot: Joi.object({
    fullName: Joi.string().trim().max(120),
    age: Joi.number().min(16).max(120),
    profileImageUrl: Joi.string().uri().max(2048).allow('', null),
    phone: Joi.string().trim(),
    gender: Joi.string().valid('male', 'female', 'other'),
    professionalType: Joi.string().valid(...PROFESSIONAL_TYPES),
    collegeOrCompanyName: Joi.string().trim().max(200),
    propertyOrPgName: Joi.string().trim().max(200),
    monthlyRent: Joi.number().min(0),
    securityDeposit: Joi.number().min(0),
    moveInDate: Joi.date(),
    moveOutDate: Joi.date(),
    roomPhotoUrls: Joi.array().items(Joi.string().uri().max(2048)).max(20),
    description: Joi.string().max(5000).allow('', null),
    lifestyle: Joi.object({
      diet: Joi.string().valid('vegetarian', 'non_vegetarian', 'eggetarian', 'vegan'),
      smoking: Joi.string().valid('non_smoker', 'smoker'),
    }).optional(),
  }).optional(),
  isPublished: Joi.boolean(),
});

exports.updateProperty = Joi.object({
  title: Joi.string().trim().max(200),
  rentRange: Joi.object({
    min: Joi.number().min(0),
    max: Joi.number().min(0),
  }),
  currency: Joi.string().uppercase().length(3),
  listingType: Joi.string().valid(...LISTING_TYPES),
  coverImageUrl: Joi.string().uri().max(2048).allow('', null),
  imageUrls: Joi.array().items(Joi.string().uri().max(2048)).max(30),
  offerText: Joi.string().trim().max(500).allow('', null),
  location: Joi.object({
    type: Joi.string().valid('Point'),
    coordinates: Joi.array().items(Joi.number()).length(2).required(),
    placeId: Joi.string().trim(),
    formattedAddress: Joi.string().trim().max(500),
  }),
  address: Joi.object({
    line1: Joi.string().trim().max(200),
    line2: Joi.string().trim().max(200),
    city: Joi.string().trim().max(100),
    state: Joi.string().trim().max(100),
    postalCode: Joi.string().trim().max(20),
    country: Joi.string().trim().max(100),
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
  listerSnapshot: Joi.object({
    fullName: Joi.string().trim().max(120),
    age: Joi.number().min(16).max(120),
    profileImageUrl: Joi.string().uri().max(2048).allow('', null),
    phone: Joi.string().trim(),
    gender: Joi.string().valid('male', 'female', 'other'),
    professionalType: Joi.string().valid(...PROFESSIONAL_TYPES),
    collegeOrCompanyName: Joi.string().trim().max(200),
    propertyOrPgName: Joi.string().trim().max(200),
    monthlyRent: Joi.number().min(0),
    securityDeposit: Joi.number().min(0),
    moveInDate: Joi.date(),
    moveOutDate: Joi.date(),
    roomPhotoUrls: Joi.array().items(Joi.string().uri().max(2048)).max(20),
    description: Joi.string().max(5000).allow('', null),
    lifestyle: Joi.object({
      diet: Joi.string().valid('vegetarian', 'non_vegetarian', 'eggetarian', 'vegan'),
      smoking: Joi.string().valid('non_smoker', 'smoker'),
    }),
  }),
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
