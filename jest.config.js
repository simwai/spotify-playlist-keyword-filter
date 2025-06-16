// jest.config.js
module.exports = {
  testEnvironment: 'jsdom', // for DOM testing
  collectCoverageFrom: [
    'frontend/**/*.js',
    '!frontend/index.js', // exclude while refactoring
  ],
  testMatch: ['**/tests/**/*.test.js', '**/__tests__/**/*.test.js'],
  // setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
}
