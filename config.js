// Configuration for different environments
const config = {
  development: {
    apiBaseUrl: 'http://localhost:8888',
    loginUrl: 'http://localhost:8888/login'
  },
  production: {
    apiBaseUrl: 'https://filteryourplaylist-rgw5tl6z2-simwais-projects.vercel.app',
    loginUrl: 'https://filteryourplaylist-rgw5tl6z2-simwais-projects.vercel.app/login'
  }
}

// Detect environment
const environment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'development' : 'production'
const currentConfig = config[environment]

// Export configuration
window.APP_CONFIG = currentConfig

console.log('Environment:', environment)
console.log('Config:', currentConfig)
