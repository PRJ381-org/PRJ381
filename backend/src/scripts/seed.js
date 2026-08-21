/**
 * Seed script to create initial Admin and Viewer user accounts.
 *
 * Usage: node src/scripts/seed.js
 */
const { connectDb } = require('../db');
const User = require('../models/User');

async function seedUsers() {
  try {
    await connectDb();
    console.log('Connected to DB for seeding users...');

    // TODO: Create initial default admin and viewer if they don't already exist
    console.log('User seed script scaffold ready.');
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed users:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  seedUsers();
}

module.exports = seedUsers;
