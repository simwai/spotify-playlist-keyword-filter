const config = require('../config/index.js')

function requireAdminAuth(req, res, next) {
  const { adminKey } = req.query

  if (adminKey !== config.admin.key) {
    return res.status(403).json({ error: 'Unauthorized' })
  }

  next()
}

module.exports = { requireAdminAuth }
