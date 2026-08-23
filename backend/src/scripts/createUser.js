/**
 * Creates (or updates) a local email/password dashboard account.
 * Usage: node src/scripts/createUser.js <email> <password> [role: viewer|admin]
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { connectDb } = require('../db');
const User = require('../models/User');

async function main() {
  const [, , email, password, role = 'viewer'] = process.argv;
  if (!email || !password) {
    console.error('Usage: node src/scripts/createUser.js <email> <password> [role]');
    process.exit(1);
  }

  await connectDb();
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.findOneAndUpdate(
    { email: email.toLowerCase() },
    { email: email.toLowerCase(), password: passwordHash, role, provider: 'local' },
    { upsert: true, new: true }
  );
  console.log(`User ready: ${user.email} (${user.role})`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
