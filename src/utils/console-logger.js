class ConsoleLogger {
  constructor(options = {}) {
    this.isTimeEnabled = options.isTimeEnabled || false
  }

  _getTimestamp() {
    return this.isTimeEnabled ? `[${new Date().toISOString()}] ` : ''
  }

  log(message, ...args) {
    console.log(`${this._getTimestamp()}${message}`, ...args)
  }

  info(message, ...args) {
    console.info(`${this._getTimestamp()}[INFO] ${message}`, ...args)
  }

  error(message, ...args) {
    console.error(`${this._getTimestamp()}[ERROR] ${message}`, ...args)
  }

  warn(message, ...args) {
    console.warn(`${this._getTimestamp()}[WARN] ${message}`, ...args)
  }

  debug(message, ...args) {
    console.debug(`${this._getTimestamp()}[DEBUG] ${message}`, ...args)
  }
}

module.exports = { ConsoleLogger }
