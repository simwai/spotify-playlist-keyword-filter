export default class UiManager {
  constructor(spotifyApiService, authService) {
    this.playlists = []
    this.tableSort = { column: null, direction: 'asc' }

    this.currentOnPlaylistSelect = null

    this.spotifyApiService = spotifyApiService
    this.authService = authService
  }

  renderKeywords(keywords, filterMode) {
    const tagsContainer = document.getElementById('tags')
    if (!tagsContainer) {
      return
    }

    tagsContainer.innerHTML = ''

    keywords.forEach((keyword, index) => {
      const tag = document.createElement('div')
      const modeClass = filterMode === 'include' ? 'include-tag' : 'exclude-tag'
      tag.className = `tag ${modeClass}`
      tag.textContent = keyword
      const removeLink = document.createElement('a')
      removeLink.href = '#'
      removeLink.className = 'remove-tag'
      removeLink.innerHTML = '&times;'
      removeLink.setAttribute('data-index', index)
      tag.appendChild(removeLink)
      tagsContainer.appendChild(tag)
    })
  }

  async loadPlaylists() {
    try {
      this.showLoader(true)

      const response = await this.spotifyApiService.getPlaylists()

      this.playlists = response.items || []
    } catch (error) {
      this.showError('Failed to load playlists.')
      console.error('API Error in loadPlaylists:', error)
      this.playlists = []
    } finally {
      this.showLoader(false)
    }
  }

  renderPlaylists(onPlaylistSelect, selectedPlaylist = null) {
    this.currentOnPlaylistSelect = onPlaylistSelect

    const playlistsTable = document.querySelector('#playlists tbody')
    if (!playlistsTable) {
      return
    }
    playlistsTable.innerHTML = ''

    const sortedPlaylists = [...this.playlists].sort((a, b) => {
      if (!this.tableSort.column) {
        return 0
      }
      const aValue =
        this.tableSort.column === 'tracks.total'
          ? a.tracks.total
          : a[this.tableSort.column]
      const bValue =
        this.tableSort.column === 'tracks.total'
          ? b.tracks.total
          : b[this.tableSort.column]
      if (aValue < bValue) {
        return this.tableSort.direction === 'asc' ? -1 : 1
      }
      if (aValue > bValue) {
        return this.tableSort.direction === 'asc' ? 1 : -1
      }
      return 0
    })

    for (const playlist of sortedPlaylists) {
      const row = document.createElement('tr')

      row.innerHTML = `
        <td><img src="${playlist.images[0]?.url || 'placeholder.jpg'}" alt="${playlist.name}" class="playlist-cover"></td>
        <td>${playlist.name}</td>
        <td>${playlist.tracks.total}</td>
      `

      if (selectedPlaylist && playlist.id === selectedPlaylist.id) {
        row.classList.add('selected')
      }

      row.addEventListener('click', () => {
        if (onPlaylistSelect) {
          onPlaylistSelect(playlist, row)
        }
      })
      playlistsTable.appendChild(row)
    }

    this._updateSortIndicators()
  }

  toggleStartButton(isProcessing) {
    const btn = document.getElementById('start-button')
    if (!btn) {
      return
    }
    btn.disabled = isProcessing
    btn.classList.toggle('opacity-50', isProcessing)
  }

  updateResultOutput(html) {
    const container = document.getElementById('result-output')
    if (container) {
      container.innerHTML = html
    }
  }

  initTableSort() {
    const headers = document.querySelectorAll('#playlists thead th[data-sort]')
    headers.forEach((header) => {
      header.addEventListener('click', () => {
        const column = header.dataset.sort
        if (this.tableSort.column === column) {
          this.tableSort.direction =
            this.tableSort.direction === 'asc' ? 'desc' : 'asc'
        } else {
          this.tableSort.column = column
          this.tableSort.direction = 'asc'
        }

        this.renderPlaylists(
          this.currentOnPlaylistSelect,
          window.appState?.selectedPlaylist
        )
      })
    })
  }

  filterModeultOutput(html) {
    const container = document.getElementById('result-output')
    if (container) {
      container.innerHTML = html
    }
  }

  showSuccess(message) {
    console.log(message)
    alert(message)
  }

  showLoader(show) {
    const loader = document.getElementById('loader')
    if (loader) {
      loader.classList.toggle('hidden', !show)
    }
  }

  showError(message) {
    console.error(message)
    alert(message)
  }

  navigateTo(view, options = {}) {
    if (view === 'login') {
      document.getElementById('login')?.classList.remove('hidden')
      document.getElementById('logged-in')?.classList.add('hidden')
      document
        .getElementById('back-to-playlists-button')
        ?.classList.add('hidden')
      return
    }

    if (view === 'logged-in') {
      document.getElementById('login')?.classList.add('hidden')
      document.getElementById('logged-in')?.classList.remove('hidden')
      this.navigateTo('playlist-selection')
      return
    }

    document
      .querySelectorAll('#logged-in > div')
      .forEach((el) => el.classList.add('hidden'))

    if (view === 'playlist-selection') {
      document.getElementById('playlist-form')?.classList.remove('hidden')
      document
        .getElementById('back-to-playlists-button')
        ?.classList.add('hidden')

      document.getElementById('playlist-title').textContent = 'Pick a playlist:'
    }

    if (view === 'tag-form') {
      document.getElementById('tag-form')?.classList.remove('hidden')
      document
        .getElementById('back-to-playlists-button')
        ?.classList.remove('hidden')

      if (options.playlist) {
        document.getElementById('playlist-title').textContent =
          options.playlist.name
      }
    }

    if (view === 'playlist-selection') {
      this.initTableSort()
    }
  }

  _updateSortIndicators() {
    const headers = document.querySelectorAll('#playlists thead th')

    for (const th of headers) {
      th.classList.remove('sort-asc', 'sort-desc')

      if (th.dataset.sort === this.tableSort.column) {
        th.classList.add(`sort-${this.tableSort.direction}`)
      }
    }
  }
}
