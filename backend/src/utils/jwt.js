const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');

const EXPIRES_IN = '8h';

function signSessionToken(user) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not set. Copy .env.example to .env.');
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: EXPIRES_IN }
  );
}

function verifySessionToken(token) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not set. Copy .env.example to .env.');
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { signSessionToken, verifySessionToken };
