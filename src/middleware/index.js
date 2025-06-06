const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const config = require('../config/index.js')

function setupMiddleware(app) {
  app.use(
    cors({
      origin: config.cors.origins,
      credentials: true,
      methods: ['GET', 'POST', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  )

  app.use(express.json())
  app.use(cookieParser())
}

module.exports = {
  setupMiddleware,
}
