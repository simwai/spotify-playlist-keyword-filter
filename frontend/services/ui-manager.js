class UiManager {
  constructor(spotifyApiService = null, authService = null) {
    this.selectedPlaylist = null
    this.playlists = []
    this.keywords = []
    this.tableSort = null
    this.spotifyApiService = spotifyApiService
    this.authService = authService
  }

  navigateTo(view, options = {}) {
    const sections = [
      'login',
      'logged-in',
      'playlist-form',
      'tag-form',
      'back-to-playlists-button',
    ]

    for (const sectionId of sections) {
      const element = document.getElementById(sectionId)
      if (element) {
        element.classList.add('hidden')
      }
    }

    if (view !== 'tag-form') {
      const playlistRows = document.querySelectorAll('#playlists tbody tr')
      for (const row of playlistRows) {
        row.classList.remove('selected')
      }
    }

    switch (view) {
      case 'login':
        document.getElementById('login').classList.remove('hidden')
        break

      case 'playlist-selection':
        document.getElementById('logged-in').classList.remove('hidden')
        document.getElementById('playlist-form').classList.remove('hidden')
        window.selectedPlaylist = null
        this.selectedPlaylist = null
        break

      case 'tag-form':
        document.getElementById('logged-in').classList.remove('hidden')
        document.getElementById('tag-form').classList.remove('hidden')
        document
          .getElementById('back-to-playlists-button')
          .classList.remove('hidden')

        if (options.playlist) {
          const tagTitle = document.querySelector('#tag-form h1')
          if (tagTitle) {
            tagTitle.textContent = `Filter "${options.playlist.name}" (${options.playlist.tracks.total} tracks):`
          }
        }
        break

      default:
        console.warn(`Unknown view: ${view}`)
    }
  }

  addKeyword() {
    const tagInput = document.getElementById('tag-input')
    const keyword = tagInput.value.trim()

    if (keyword && !this.keywords.includes(keyword)) {
      this.keywords.push(keyword)
      this.renderKeywords()
      tagInput.value = ''

      const startButton = document.getElementById('start-button')
      if (startButton) {
        if (this.keywords.length > 0) {
          startButton.classList.remove('hidden')
        } else {
          startButton.classList.add('hidden')
        }
      }
    }
  }

  async loadPlaylists() {
    if (!this.authService.isAuthenticated()) {
      this.showError('Access token not available. Please log in.')
      this.navigateTo('login')
      return
    }

    if (!this.authService.userId) {
      this.showError('User ID not available. Please try logging in again.')
      this.navigateTo('login')
      return
    }

    this.updateResultOutput('<span>🔄 Loading your playlists...</span>')

    try {
      const data = await this.spotifyApiService.getPlaylists()

      this.playlists = data.items
      this.renderPlaylists()
      this.navigateTo('playlist-selection')

      if (this.playlists.length === 0) {
        this.updateResultOutput(
          '<span>🤔 No playlists found, or unable to load them.</span>'
        )
      } else {
        this.updateResultOutput(
          `<span class="pt-8">✅ Loaded ${this.playlists.length} playlists. Select one to continue.</span>`
        )
      }

      this.initTableSort()
    } catch (error) {
      console.error('Error loading playlists:', error)
      this.showError(`Failed to load playlists: ${error.message}`)
    }
  }

  renderPlaylists() {
    const playlistsTable = document.querySelector('#playlists tbody')
    if (!playlistsTable) {
      console.warn('#playlists tbody not found for rendering.')
      return
    }

    playlistsTable.innerHTML = ''

    if (!this.playlists || this.playlists.length === 0) {
      playlistsTable.innerHTML =
        '<tr><td colspan="2" class="p-4 text-center text-gray-500 border-b">No playlists found.</td></tr>'
      return
    }

    for (const playlist of this.playlists) {
      const row = document.createElement('tr')

      row.className = 'hover:bg-gray-50 cursor-pointer transition-colors'
      const playlistName = playlist.name || 'Unnamed Playlist'
      const trackTotal =
        playlist.tracks && typeof playlist.tracks.total === 'number'
          ? playlist.tracks.total
          : 'N/A'

      row.innerHTML = `
        <td class="p-4 border-b border-gray-200">${playlistName}</td>
        <td class="p-4 border-b border-gray-200" data-sort="${typeof trackTotal === 'number' ? trackTotal : -1}">${trackTotal}</td>
      `

      row.addEventListener('click', () => this.selectPlaylist(playlist, row))
      playlistsTable.appendChild(row)
    }
  }

  selectPlaylist(playlist, rowElement) {
    const selectedPlaylistRows = document.querySelectorAll(
      '#playlists tbody tr.selected'
    )
    for (const activeRow of selectedPlaylistRows) {
      activeRow.classList.remove('selected')
    }

    this.selectedPlaylist = playlist
    rowElement.classList.add('selected')

    console.log('Selected playlist:', playlist.name, playlist.id)

    this.navigateTo('tag-form', { playlist })
    this.updateResultOutput('')
  }

  renderKeywords(filterMode = 'exclude') {
    const tagsContainer = document.getElementById('tags')
    if (!tagsContainer) {
      console.warn('#tags container not found for rendering keywords.')
      return
    }

    tagsContainer.innerHTML = ''

    this.keywords.forEach((keyword, index) => {
      const tag = document.createElement('span')

      tag.className = `tag flex items-center px-3 py-2 rounded-full m-1 ${
        filterMode === 'exclude'
          ? 'bg-red-100 text-red-800 border border-red-200'
          : 'bg-green-100 text-green-800 border border-green-200'
      } transition-all hover:shadow-sm`

      const iconSpan = document.createElement('span')
      iconSpan.className = 'mr-2 flex items-center justify-center'
      iconSpan.innerHTML =
        filterMode === 'exclude'
          ? '<i class="fas fa-ban text-xs opacity-70"></i>'
          : '<i class="fas fa-check text-xs opacity-70"></i>'
      tag.appendChild(iconSpan)

      const textSpan = document.createElement('span')
      textSpan.textContent = keyword
      tag.appendChild(textSpan)

      const removeLink = document.createElement('a')
      removeLink.innerHTML = '&times;'
      removeLink.href = '#'

      removeLink.className =
        'remove-tag inline-flex items-center justify-center ml-2 w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-600 hover:text-gray-800 transition-colors'
      removeLink.setAttribute('aria-label', `Remove keyword ${keyword}`)
      removeLink.setAttribute('role', 'button')

      removeLink.onclick = (event) => {
        event.preventDefault()
        this.removeKeyword(index)
      }

      tag.appendChild(removeLink)
      tagsContainer.appendChild(tag)
    })
  }

  removeKeyword(index) {
    const tagsContainer = document.getElementById('tags')
    const tagElements = tagsContainer.querySelectorAll('.tag')
    const tagToRemove = tagElements[index]

    if (tagToRemove) {
      tagToRemove.classList.add('removing')

      setTimeout(() => {
        this.keywords.splice(index, 1)
        this.renderKeywords()

        const startButton = document.getElementById('start-button')
        if (startButton) {
          if (this.keywords.length > 0) {
            startButton.classList.remove('hidden')
          } else {
            startButton.classList.add('hidden')
          }
        }
      }, 300)
    } else {
      this.keywords.splice(index, 1)
      this.renderKeywords()
    }
  }

  initTableSort() {
    const table = document.getElementById('playlists')
    if (table) {
      if (this.tableSort) {
        this.tableSort.destroy()
      }
      this.tableSort = new Tablesort(table)

      const headers = table.querySelectorAll('th[role="columnheader"]')
      for (const header of headers) {
        if (!header.hasAttribute('title')) {
          header.setAttribute('title', 'Click to sort')
        }
      }
    }
  }

  async startFiltering() {
    if (!this.selectedPlaylist) {
      this.showError('Please select a playlist.')
      return
    }

    if (this.keywords.length === 0) {
      this.showError('Please add keywords.')
      return
    }

    const startButton = document.getElementById('start-button')
    if (startButton) {
      startButton.disabled = true
      startButton.classList.add('opacity-70')
    }

    this.updateResultOutput(
      `<div class="flex items-center justify-center py-4 gap-3">
        <div class="inline-flex items-center justify-center w-6 h-6 border-2 border-t-transparent border-spotify-green rounded-full animate-spin" role="status"></div>
        <span class="text-gray-800">🚀 Starting filter process...</span>
      </div>`
    )

    try {
      let processedTrackCount = 0
      let totalFilteredOutCount = 0
      const allTracksToKeep = []
      const BATCH_SIZE_PROCESSING = 10
      let currentProcessingBatch = []
      let batchNumber = 0

      const trackGenerator = this._fetchPlaylistTracksGenerator()

      for await (const track of trackGenerator) {
        currentProcessingBatch.push(track)
        processedTrackCount++

        if (
          currentProcessingBatch.length >= BATCH_SIZE_PROCESSING ||
          processedTrackCount === this.selectedPlaylist.tracks.total
        ) {
          batchNumber++
          this.updateResultOutput(
            `<span>🔄 Processing batch ${batchNumber} of tracks for lyrics & filtering... (Processed: ${processedTrackCount}/${this.selectedPlaylist.tracks.total})</span>`
          )
          const batchResult = await this._processTrackBatch(
            currentProcessingBatch,
            batchNumber
          )
          allTracksToKeep.push(...batchResult.tracksToKeep)
          totalFilteredOutCount += batchResult.filteredOutCountInBatch
          currentProcessingBatch = []

          this.updateResultOutput(
            `<span>🔄 Processed: ${processedTrackCount}/${this.selectedPlaylist.tracks.total} | Kept so far: ${allTracksToKeep.length} | Filtered out: ${totalFilteredOutCount}</span>`
          )
        }
      }
      if (currentProcessingBatch.length > 0) {
        batchNumber++
        this.updateResultOutput(
          `<span>🔄 Processing final batch ${batchNumber} of tracks... (Processed: ${processedTrackCount}/${this.selectedPlaylist.tracks.total})</span>`
        )
        const batchResult = await this._processTrackBatch(
          currentProcessingBatch,
          batchNumber
        )
        allTracksToKeep.push(...batchResult.tracksToKeep)
        totalFilteredOutCount += batchResult.filteredOutCountInBatch
        this.updateResultOutput(
          `<span>🏁 Track processing complete. Total Processed: ${processedTrackCount} | Total Kept: ${allTracksToKeep.length} | Total Filtered Out: ${totalFilteredOutCount}</span>`
        )
      }

      if (allTracksToKeep.length > 0) {
        const newPlaylist = await this._createFilteredPlaylist()
        if (newPlaylist && newPlaylist.id) {
          const trackUrisToKeep = allTracksToKeep
            .map((track) => track.uri)
            .filter((uri) => this.spotifyApiService.isValidSpotifyUri(uri))

          console.log(
            `📊 Track URI validation: ${allTracksToKeep.length} tracks -> ${trackUrisToKeep.length} valid URIs`
          )

          if (trackUrisToKeep.length > 0) {
            await this.spotifyApiService.addTracksToSpotifyPlaylist(
              newPlaylist.id,
              trackUrisToKeep
            )
            const invalidUriCount =
              allTracksToKeep.length - trackUrisToKeep.length
            const successMessage = `✅ Filtering complete! New playlist "${newPlaylist.name}" created with ${trackUrisToKeep.length} tracks. ${totalFilteredOutCount} tracks were filtered out.`
            const invalidUriMessage =
              invalidUriCount > 0
                ? ` (${invalidUriCount} tracks had invalid URIs and were skipped)`
                : ''

            this.showSuccess(
              successMessage +
                invalidUriMessage +
                ` <a href="${newPlaylist.external_urls.spotify}" target="_blank" class="text-spotify-green hover:underline">Open Playlist</a>`
            )
          } else {
            this.showError(
              'No valid track URIs found. Unable to create playlist.'
            )
          }
        }
      } else {
        this.showSuccess(
          `ℹ️ Filtering complete. No tracks matched your criteria to be kept. ${totalFilteredOutCount} tracks were filtered out.`
        )
      }
    } catch (error) {
      console.error('❌ Filtering process failed:', error)
      this.showError(
        `Filtering process failed: ${error.message || 'An unknown error occurred.'}`
      )
    } finally {
      if (startButton) {
        startButton.disabled = false
        startButton.classList.remove('opacity-70')
      }
    }
  }

  showError(message) {
    const resultOutput = document.getElementById('result-output')
    if (resultOutput) {
      resultOutput.innerHTML = `<div class="w-full p-4 bg-red-100 text-red-800 rounded-lg border border-red-200 mt-4">${message}</div>`
    } else {
      console.error('Could not show error, #result-output not found:', message)
    }
  }

  showSuccess(message) {
    const resultOutput = document.getElementById('result-output')
    if (resultOutput) {
      resultOutput.innerHTML = `<div class="w-full p-4 bg-green-100 text-green-800 rounded-lg border border-green-200 mt-4">${message}</div>`
    } else {
      console.error(
        'Could not show success, #result-output not found:',
        message
      )
    }
  }

  updateResultOutput(htmlContent) {
    const resultOutput = document.getElementById('result-output')
    if (resultOutput) {
      resultOutput.innerHTML = htmlContent
    }
  }
}

export default UiManager
