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

    const playlistsContainer = document.querySelector('#playlists')
    if (!playlistsContainer) {
      return
    }

    playlistsContainer.innerHTML = ''

    const header = document.createElement('div')
    header.className = 'flex w-full bg-gray-900 text-white sticky top-0'

    const headerCover = document.createElement('div')
    headerCover.className = 'flex items-center p-4 w-1/4 md:w-1/6'
    headerCover.textContent = 'Cover'
    headerCover.setAttribute('role', 'columnheader')

    const headerName = document.createElement('div')
    headerName.className = 'flex items-center p-4 flex-1 cursor-pointer'
    headerName.textContent = 'Name'
    headerName.setAttribute('role', 'columnheader')
    headerName.setAttribute('data-sort', 'name')

    const headerTracks = document.createElement('div')
    headerTracks.className =
      'flex items-center p-4 w-1/4 md:w-1/6 justify-end cursor-pointer'
    headerTracks.textContent = 'Track Count'
    headerTracks.setAttribute('role', 'columnheader')
    headerTracks.setAttribute('data-sort', 'tracks.total')
    headerTracks.setAttribute('data-sort-method', 'number')

    const _createSortIndicator = (column) => {
      const indicator = document.createElement('span')
      indicator.className =
        'inline-flex items-center justify-center ml-2 w-4 h-4'

      if (this.tableSort.column === column) {
        indicator.classList.add('text-white')
        const icon = document.createElement('i')
        icon.className =
          this.tableSort.direction === 'asc'
            ? 'fas fa-sort-up'
            : 'fas fa-sort-down'
        indicator.appendChild(icon)
      } else {
        const icon = document.createElement('i')
        icon.className = 'fas fa-sort text-gray-400'
        indicator.appendChild(icon)
      }

      return indicator
    }

    const nameIndicator = _createSortIndicator('name')
    const tracksIndicator = _createSortIndicator('tracks.total')

    headerName.appendChild(nameIndicator)
    headerTracks.appendChild(tracksIndicator)

    headerName.addEventListener('click', () => {
      this._handleHeaderClick('name')
    })

    headerTracks.addEventListener('click', () => {
      this._handleHeaderClick('tracks.total')
    })

    header.appendChild(headerCover)
    header.appendChild(headerName)
    header.appendChild(headerTracks)

    playlistsContainer.appendChild(header)

    const content = document.createElement('div')
    content.className = 'flex flex-col w-full'

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
      const row = document.createElement('div')
      row.className =
        'flex w-full items-center border-b border-gray-200 hover:bg-gray-50 transition-colors duration-200 cursor-pointer'

      if (selectedPlaylist && playlist.id === selectedPlaylist.id) {
        row.classList.add('bg-green-50', 'border-l-3', 'border-l-green-500')
      }

      const coverCell = document.createElement('div')
      coverCell.className = 'flex p-4 w-1/4 md:w-1/6'
      const coverImg = document.createElement('img')
      coverImg.src = playlist.images[0]?.url || 'placeholder.jpg'
      coverImg.alt = playlist.name
      coverImg.className =
        'w-full h-auto rounded-md min-h-[60px] min-w-[60px] aspect-square object-cover bg-gray-200'
      coverCell.appendChild(coverImg)

      const nameCell = document.createElement('div')
      nameCell.className = 'flex items-center p-4 flex-1 font-medium'
      nameCell.textContent = playlist.name

      const trackCountCell = document.createElement('div')
      trackCountCell.className =
        'flex items-center justify-end p-4 w-1/4 md:w-1/6'
      trackCountCell.textContent = playlist.tracks.total

      row.appendChild(coverCell)
      row.appendChild(nameCell)
      row.appendChild(trackCountCell)

      row.addEventListener('click', () => {
        if (onPlaylistSelect) {
          onPlaylistSelect(playlist, row)
        }
      })

      content.appendChild(row)
    }

    playlistsContainer.appendChild(content)
  }

  _handleHeaderClick(column) {
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

  showLoader(show) {
    const loader = document.getElementById('loader')
    if (loader) {
      if (show) {
        loader.classList.remove('hidden')
        loader.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 300,
          easing: 'ease-out',
        })
      } else {
        const animation = loader.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 300,
          easing: 'ease-in',
        })

        animation.onfinish = () => {
          loader.classList.add('hidden')
        }
      }
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
  }
}
