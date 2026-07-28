const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { CORS_ORIGIN, NODE_ENV } = require('./config/env');

const healthRoutes = require('./routes/health.routes');
const leadsRoutes = require('./routes/leads.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const notFound = require('./utils/notFound');
const errorHandler = require('./utils/errorHandler');

const app = express();

app.use(helmet());
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: '100kb' }));
if (NODE_ENV !== 'test') app.use(morgan('dev'));

app.use('/health', healthRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/analytics', analyticsRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
