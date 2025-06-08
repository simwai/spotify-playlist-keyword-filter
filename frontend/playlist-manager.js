window.SpotifyPlaylistFilter = window.SpotifyPlaylistFilter || {}

class PlaylistManager {
  constructor(spotifyApi, uiManager) {
    this.spotifyApi = spotifyApi
    this.uiManager = uiManager
  }

  async loadUserPlaylist() {
    this.uiManager.updateResultOutput(
      '<span><i class="fas fa-sync-alt fa-spin mr-2"></i>Loading your playlists...</span>'
    )

    try {
      const data = await this.spotifyApi.getUserPlaylist(50)
      const playlist = data.items

      if (playlist.length === 0) {
        this.uiManager.updateResultOutput(
          '<span><i class="fas fa-question-circle mr-2"></i>No playlists found, or unable to load them.</span>'
        )
      } else {
        this.uiManager.updateResultOutput(
          `<span class="pt-8"><i class="fas fa-check-circle text-green-600 mr-2"></i>Loaded ${playlist.length} playlists. Select one to continue.</span>`
        )
      }

      return playlist
    } catch (error) {
      console.error('Error loading playlists:', error)
      throw new window.SpotifyPlaylistFilter.PlaylistError(
        `Failed to load playlists: ${error.message}`,
        error
      )
    }
  }

  async * fetchPlaylistTracksGenerator(selectedPlaylist) {
    if (!selectedPlaylist) {
      throw new window.SpotifyPlaylistFilter.PlaylistError(
        'Playlist not selected for fetching tracks.'
      )
    }

    let offset = 0
    const limit = window.SpotifyPlaylistFilter.config.spotify.batchSize.fetching
    let hasMoreData = true
    let batchCount = 0
    let totalFetched = 0

    console.log(
      `<i class="fas fa-download mr-2"></i>Starting to fetch tracks from playlist: ${selectedPlaylist.name}`
    )
    this.uiManager.updateResultOutput(
      `<span><i class="fas fa-sync-alt fa-spin mr-2"></i>Fetching tracks from "${selectedPlaylist.name}"...</span>`
    )

    while (hasMoreData) {
      batchCount++
      console.log(
        `<i class="fas fa-satellite-dish mr-2"></i>Fetching tracks batch ${batchCount} (offset: ${offset})`
      )

      try {
        const response = await this.spotifyApi.getPlaylistTrack(
          selectedPlaylist.id,
          offset,
          limit
        )
        const item = response.items

        if (item && item.length > 0) {
          const validTrack = item.filter(
            (item) =>
              item?.track &&
              item.track.artists?.length > 0 &&
              item.track.name &&
              item.track.uri
          )

          const invalidUriTrack = validTrack.filter(
            (trackItem) =>
              !window.SpotifyPlaylistFilter.util.isValidSpotifyUri(
                trackItem.track.uri
              )
          )

          if (invalidUriTrack.length > 0) {
            console.warn(
              `<i class="fas fa-exclamation-triangle mr-2"></i>Found ${invalidUriTrack.length} tracks with invalid URIs in fetch batch ${batchCount}:`
            )
            invalidUriTrack.forEach((trackItem) => {
              console.warn(
                `  → "${trackItem.track.name}" by ${trackItem.track.artists[0].name}: ${trackItem.track.uri}`
              )
            })
          }

          totalFetched += validTrack.length
          console.log(
            `<i class="fas fa-check-circle text-green-600 mr-2"></i>Batch ${batchCount}: Got ${validTrack.length} valid tracks (total: ${totalFetched})`
          )
          this.uiManager.updateResultOutput(
            `<span><i class="fas fa-sync-alt fa-spin mr-2"></i>Fetched ${totalFetched} / ${selectedPlaylist.tracks.total} tracks...</span>`
          )

          for (const trackItem of validTrack) {
            yield trackItem.track
          }

          offset += item.length
          if (!response.next) {
            hasMoreData = false
            console.log(
              `<i class="fas fa-flag-checkered mr-2"></i>Reached end of playlist - total valid tracks: ${totalFetched}`
            )
          }
        } else {
          hasMoreData = false
          console.log(
            `<i class="fas fa-flag-checkered mr-2"></i>No more tracks found - total valid tracks: ${totalFetched}`
          )
        }
      } catch (error) {
        console.error(
          `<i class="fas fa-times-circle text-red-600 mr-2"></i>Error fetching tracks batch ${batchCount}:`,
          error
        )
        throw new window.SpotifyPlaylistFilter.PlaylistError(
          `Error fetching playlist tracks: ${error.message}`,
          error
        )
      }
    }
  }

  async createFilteredPlaylist(selectedPlaylist, userId, keyword, filterMode) {
    if (!selectedPlaylist || !userId) {
      throw new window.SpotifyPlaylistFilter.PlaylistError(
        'Cannot create playlist without selected playlist or user ID.'
      )
    }

    const newPlaylistName = `${selectedPlaylist.name}`
    this.uiManager.updateResultOutput(
      `<span><i class="fas fa-edit mr-2"></i>Creating new playlist: "${newPlaylistName}"...</span>`
    )

    try {
      const playlistData = await this.spotifyApi.createPlaylist(
        userId,
        newPlaylistName,
        `Filtered based on keywords: ${keyword.join(', ')} (Mode: ${filterMode})`,
        false
      )

      console.log(
        '<i class="fas fa-party-horn mr-2"></i>New playlist created:',
        playlistData.name,
        playlistData.id
      )
      return playlistData
    } catch (error) {
      console.error(
        '<i class="fas fa-times-circle text-red-600 mr-2"></i>Error creating playlist:',
        error
      )
      throw new window.SpotifyPlaylistFilter.PlaylistError(
        `Failed to create new playlist: ${error.message}`,
        error
      )
    }
  }

  async addTracksToPlaylist(playlistId, trackUri) {
    if (!trackUri || trackUri.length === 0) {
      console.log(
        '<i class="fas fa-shrug mr-2"></i>No tracks to add to the playlist.'
      )
      this.uiManager.updateResultOutput(
        '<span><i class="fas fa-exclamation-triangle text-yellow-600 mr-2"></i>No tracks matched the filter criteria to add to the new playlist.</span>'
      )
      return
    }

    const batchSize =
      window.SpotifyPlaylistFilter.config.spotify.batchSize.adding
    console.log(
      `<i class="fas fa-box mr-2"></i>Adding ${trackUri.length} tracks in batches of ${batchSize} to playlist ${playlistId}...`
    )
    this.uiManager.updateResultOutput(
      `<span><i class="fas fa-upload mr-2"></i>Adding ${trackUri.length} tracks to the new playlist...</span>`
    )

    for (let i = 0; i < trackUri.length; i += batchSize) {
      const batch = trackUri.slice(i, i + batchSize)
      const batchNumber = Math.floor(i / batchSize) + 1
      const totalBatch = Math.ceil(trackUri.length / batchSize)

      console.log(
        `<i class="fas fa-upload mr-2"></i>Sending batch ${batchNumber}/${totalBatch} (${batch.length} tracks)...`
      )

      const invalidUri = batch.filter(
        (uri) => !window.SpotifyPlaylistFilter.util.isValidSpotifyUri(uri)
      )
      if (invalidUri.length > 0) {
        console.error(
          `<i class="fas fa-times-circle text-red-600 mr-2"></i>Batch ${batchNumber} contains ${invalidUri.length} invalid URIs:`,
          invalidUri
        )
        this.uiManager.showError(
          `Batch ${batchNumber} contains invalid track URIs. Skipping this batch.`
        )
        continue
      }

      this.uiManager.updateResultOutput(
        `<span><i class="fas fa-upload mr-2"></i>Adding batch ${batchNumber}/${totalBatch} of tracks...</span>`
      )

      try {
        await this.spotifyApi.addTrackToPlaylist(playlistId, batch)
        console.log(
          `<i class="fas fa-check-circle text-green-600 mr-2"></i>Batch ${batchNumber}/${totalBatch} added successfully`
        )
      } catch (error) {
        console.error(
          `<i class="fas fa-times-circle text-red-600 mr-2"></i>Failed to add batch ${batchNumber}/${totalBatch}:`,
          error
        )
        throw new window.SpotifyPlaylistFilter.PlaylistError(
          `Failed to add tracks (batch ${batchNumber}) to playlist: ${error.message}`,
          error
        )
      }
    }

    console.log(
      `<i class="fas fa-party-horn mr-2"></i>All ${trackUri.length} tracks added to playlist ${playlistId} successfully!`
    )
  }
}

window.SpotifyPlaylistFilter.PlaylistManager = PlaylistManager
