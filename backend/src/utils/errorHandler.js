// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, next) => {
  const status = err.status || 500;
  if (process.env.NODE_ENV !== 'test') console.error(err);
  res.status(status).json({
    success: false,
    message: err.message || 'Internal server error',
  });
};
