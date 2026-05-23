/** Public listing browse: pinned PGs first, then newest. */
const PUBLIC_PROPERTY_LIST_SORT = { isFeatured: -1, featuredAt: -1, createdAt: -1 };

const ADMIN_PROPERTY_LIST_SORT = { isFeatured: -1, featuredAt: -1, createdAt: -1 };

module.exports = {
  PUBLIC_PROPERTY_LIST_SORT,
  ADMIN_PROPERTY_LIST_SORT,
};
