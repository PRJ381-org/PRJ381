require('dotenv').config();
const app = require('./app');
const { connectDb } = require('./db');
const { PORT } = require('./config/env');

async function start() {
  await connectDb();
  app.listen(PORT, () => console.log(`PRJ381 backend listening on :${PORT}`));
}

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
