const mongoose = require('mongoose');
const { MONGODB_URI } = require('./config/env');

async function connectDb() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not set. Copy .env.example to .env.');
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(MONGODB_URI);
  console.log('MongoDB connected');
}

// 0=disconnected 1=connected 2=connecting 3=disconnecting
function dbState() {
  return mongoose.connection.readyState;
}

module.exports = { connectDb, dbState };
