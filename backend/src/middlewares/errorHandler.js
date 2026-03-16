function errorHandler(err, req, res, next) {
  const status = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  if (process.env.NODE_ENV !== 'production') {
    return res.status(status).json({
      ok: false,
      message,
      stack: err.stack,
    });
  }

  return res.status(status).json({
    ok: false,
    message: status >= 500 ? 'Internal Server Error' : message,
  });
}

module.exports = { errorHandler };
