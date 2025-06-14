module.exports = {
  apps: [
    {
      name: 'spotify-playlist-keyword-filter',
      script: './src/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    },
  ],
}
