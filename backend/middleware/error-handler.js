function errorHandler(error, req, res, next) {
  console.error('💥 Unhandled error:', error)

  if (res.headersSent) {
    return next(error)
  }

  res.status(500).json({
    error: 'Internal server error',
    message:
      process.env.NODE_ENV === 'development'
        ? error.message
        : 'Something went wrong',
  })
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Route not found' })
}

module.exports = { errorHandler, notFoundHandler }
