export default class UiManager {
  constructor(spotifyApiService, authService) {
    this.playlists = []
    this.tableSort = { column: null, direction: 'asc' }

    this.currentOnPlaylistSelect = null

    this.spotifyApiService = spotifyApiService
    this.authService = authService

    this.designTokens = {
      spacing: {
        cell: 'p-3 md:p-4',
        compact: 'p-2 md:p-3',
      },
      layout: {
        coverCell: 'w-20 md:w-24',
        nameCell: 'flex-1',
        countCell: 'w-20 md:w-24',
      },
      styling: {
        headerBase: 'flex items-center bg-gray-900 text-white',
        rowBase:
          'flex items-center border-b border-gray-200 hover:bg-gray-50 transition-colors duration-200 cursor-pointer',
        selectedRow: 'bg-green-50 border-l-4 border-l-green-500',
      },
    }
  }

  _createHeaderCell(content, options = {}) {
    const {
      layoutClass = '',
      sortable = false,
      sortColumn = null,
      sortMethod = 'string',
    } = options

    const cell = document.createElement('div')
    cell.className = `${this.designTokens.styling.headerBase} ${this.designTokens.spacing.cell} ${layoutClass}`

    if (sortable) {
      cell.classList.add('cursor-pointer')
      cell.setAttribute('role', 'columnheader')
      cell.setAttribute('data-sort', sortColumn)
      if (sortMethod === 'number') {
        cell.setAttribute('data-sort-method', 'number')
      }
    }

    if (typeof content === 'string') {
      cell.textContent = content
    } else {
      cell.appendChild(content)
    }

    return cell
  }

  _createRowCell(content, layoutClass = '') {
    const cell = document.createElement('div')
    cell.className = `flex items-center ${this.designTokens.spacing.cell} ${layoutClass}`

    if (typeof content === 'string') {
      cell.textContent = content
    } else {
      cell.appendChild(content)
    }

    return cell
  }

  _createSortIndicator(column) {
    const indicator = document.createElement('span')
    indicator.className = 'inline-flex items-center justify-center ml-2 w-4 h-4'

    const icon = document.createElement('i')

    if (this.tableSort.column === column) {
      indicator.classList.add('text-white')
      icon.className =
        this.tableSort.direction === 'asc'
          ? 'fas fa-sort-up'
          : 'fas fa-sort-down'
    } else {
      icon.className = 'fas fa-sort text-gray-400'
    }

    indicator.appendChild(icon)
    return indicator
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
      this.navigateTo('login')
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
    header.className = 'flex w-full sticky top-0'

    const headerCover = this._createHeaderCell('Cover', {
      layoutClass: this.designTokens.layout.coverCell,
    })

    const headerNameContent = document.createElement('div')
    headerNameContent.className = 'flex items-center'
    headerNameContent.textContent = 'Name'
    headerNameContent.appendChild(this._createSortIndicator('name'))

    const headerName = this._createHeaderCell(headerNameContent, {
      layoutClass: this.designTokens.layout.nameCell,
      sortable: true,
      sortColumn: 'name',
    })

    const headerTracksContent = document.createElement('div')
    headerTracksContent.className = 'flex items-center justify-end'
    headerTracksContent.textContent = 'Track Count'
    headerTracksContent.appendChild(this._createSortIndicator('tracks.total'))

    const headerTracks = this._createHeaderCell(headerTracksContent, {
      layoutClass: this.designTokens.layout.countCell,
      sortable: true,
      sortColumn: 'tracks.total',
      sortMethod: 'number',
    })

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

      row.className = `${this.designTokens.styling.rowBase} w-full`

      if (selectedPlaylist && playlist.id === selectedPlaylist.id) {
        row.classList.add(...this.designTokens.styling.selectedRow.split(' '))
      }

      const coverImg = document.createElement('img')
      coverImg.src = playlist.images[0]?.url || 'placeholder.jpg'
      coverImg.alt = playlist.name

      coverImg.className =
        'h-12 w-12 md:h-16 md:w-16 rounded-md object-cover bg-gray-200'

      const coverCell = this._createRowCell(
        coverImg,
        this.designTokens.layout.coverCell
      )
      const nameCell = this._createRowCell(
        playlist.name,
        `${this.designTokens.layout.nameCell} font-medium`
      )
      const trackCountCell = this._createRowCell(
        playlist.tracks.total.toString(),
        `${this.designTokens.layout.countCell} justify-end`
      )

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
