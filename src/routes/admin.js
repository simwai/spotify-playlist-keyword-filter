const express = require('express')
const { AdminService } = require('../services/admin.js')
const { requireAdminAuth } = require('../middleware/auth.js')

const router = express.Router()
const adminService = new AdminService()

router.delete('/cache', requireAdminAuth, async (req, res) => {
  try {
    await adminService.clearCache()
    res.json({ success: true, message: 'Cache cleared' })
  } catch (error) {
    console.error('❌ Clear cache error:', error)
    res.status(500).json({ error: 'Failed to clear cache' })
  }
})

router.get('/cache-stats', requireAdminAuth, async (req, res) => {
  try {
    const stats = await adminService.getCacheStats()
    res.json(stats)
  } catch (error) {
    console.error('❌ Cache stats error:', error)
    res.status(500).json({ error: 'Failed to get cache stats' })
  }
})

module.exports = router
