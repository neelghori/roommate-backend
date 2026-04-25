/**
 * Seed amenities matching the website listing form (name match for ID resolution).
 * Run: node src/seeders/seedAmenities.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Amenity = require('../models/Amenity');
const connectDB = require('../config/db');

const NAMES = [
  'WiFi',
  'AC',
  'Food',
  'Laundry',
  'Parking',
  'Gym',
  'Kitchen',
  'Security',
  'Power Backup',
  'CCTV',
];

async function run() {
  await connectDB();
  for (const name of NAMES) {
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    await Amenity.findOneAndUpdate(
      { slug },
      { $setOnInsert: { name, slug, isActive: true } },
      { upsert: true },
    );
  }
  /* eslint-disable no-console */
  console.log('Amenities seeded:', NAMES.length);
  await mongoose.disconnect();
}

run().catch((e) => {
  /* eslint-disable no-console */
  console.error(e);
  process.exit(1);
});
