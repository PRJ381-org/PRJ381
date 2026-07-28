// Central config. No side effects (safe to import in tests).
module.exports = {
  PORT: process.env.PORT || 4000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI, // validated in connectDb()
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
};
