const Property = require('../models/Property');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Faq = require('../models/Faq');
const Amenity = require('../models/Amenity');
const catchAsync = require('../utils/catchAsync');

/** Last 12 calendar months in UTC, oldest first (YYYY-MM). */
function buildUtcMonthKeys() {
  const keys = [];
  const now = new Date();
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    keys.push(`${y}-${String(m).padStart(2, '0')}`);
  }
  return keys;
}

function monthLabelUtc(yearMonth) {
  const [ys, ms] = yearMonth.split('-');
  const y = parseInt(ys, 10);
  const mo = parseInt(ms, 10) - 1;
  const d = new Date(Date.UTC(y, mo, 1));
  return new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

exports.getOverview = catchAsync(async (req, res) => {
  const monthKeys = buildUtcMonthKeys();
  const rangeStart = new Date(Date.UTC(
    parseInt(monthKeys[0].slice(0, 4), 10),
    parseInt(monthKeys[0].slice(5, 7), 10) - 1,
    1,
  ));

  const [
    totalProperties,
    totalUsers,
    totalBookings,
    totalFaqs,
    totalAmenities,
    monthlyAgg,
  ] = await Promise.all([
    Property.countDocuments(),
    User.countDocuments(),
    Booking.countDocuments(),
    Faq.countDocuments(),
    Amenity.countDocuments(),
    Property.aggregate([
      { $match: { createdAt: { $gte: rangeStart } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: 'UTC' },
          },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const countByMonth = Object.fromEntries(
    monthlyAgg.map((row) => [row._id, row.count]),
  );

  const propertiesAddedMonthly = monthKeys.map((monthKey) => ({
    monthKey,
    label: monthLabelUtc(monthKey),
    count: countByMonth[monthKey] ?? 0,
  }));

  res.json({
    status: 'ok',
    data: {
      totalProperties,
      totalUsers,
      totalBookings,
      totalFaqs,
      totalAmenities,
      propertiesAddedMonthly,
    },
  });
});
