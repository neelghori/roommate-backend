require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const { USER_ROLES } = require('../constants/roles');

require('../config/env');

async function run() {
  const email = (process.env.SUPERADMIN_EMAIL || '').toLowerCase().trim();
  const password = process.env.SUPERADMIN_PASSWORD || '';
  const fullName = (process.env.SUPERADMIN_NAME || 'Super Admin').trim();

  if (!email || !password) {
    console.error('Missing SUPERADMIN_EMAIL or SUPERADMIN_PASSWORD in .env');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('SUPERADMIN_PASSWORD must be at least 8 characters');
    process.exit(1);
  }

  await connectDB();

  let user = await User.findOne({ email }).select('+password');
  if (user) {
    user.fullName = fullName;
    user.role = USER_ROLES.SUPERADMIN;
    user.password = password;
    user.isActive = true;
    await user.save();
    await User.updateOne({ _id: user._id }, { $unset: { mobile: '', professionalType: '' } });
    console.log(`Updated superadmin: ${email}`);
  } else {
    await User.create({
      fullName,
      email,
      role: USER_ROLES.SUPERADMIN,
      password,
    });
    console.log(`Created superadmin: ${email}`);
  }

  await mongoose.connection.close();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
