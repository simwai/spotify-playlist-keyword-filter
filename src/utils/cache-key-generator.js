class CacheKeyGenerator {
  generate(artist, song) {
    return `${artist.toLowerCase()}-${song.toLowerCase()}`.replace(
      /[^a-z0-9-]/g,
      ''
    )
  }
}

module.exports = { CacheKeyGenerator }
