window.SpotifyPlaylistFilter = window.SpotifyPlaylistFilter || {}

class UiManager {
  constructor() {
    this.tableSort = null
  }

  navigateTo(view, option = {}) {
    const section = [
      'login',
      'logged-in',
      'playlist-form',
      'tag-form',
      'back-to-playlists-button',
    ]

    section.forEach((sectionId) => {
      const element = document.getElementById(sectionId)
      if (element) {
        element.classList.add('hidden')
      }
    })

    if (view !== 'tag-form') {
      document.querySelectorAll('#playlists tbody tr').forEach((row) => {
        row.classList.remove('selected')
      })
    }

    switch (view) {
      case 'login':
        document.getElementById('login').classList.remove('hidden')
        break

      case 'playlist-selection':
        document.getElementById('logged-in').classList.remove('hidden')
        document.getElementById('playlist-form').classList.remove('hidden')
        break

      case 'tag-form':
        document.getElementById('logged-in').classList.remove('hidden')
        document.getElementById('tag-form').classList.remove('hidden')
        document
          .getElementById('back-to-playlists-button')
          .classList.remove('hidden')

        if (option.playlist) {
          const tagTitle = document.querySelector('#tag-form h1')
          if (tagTitle) {
            tagTitle.textContent = `Filter "${option.playlist.name}" (${option.playlist.tracks.total} tracks):`
          }
        }
        break

      default:
        console.warn(`Unknown view: ${view}`)
    }
  }

  renderPlaylist(playlist) {
    const playlistTable = document.querySelector('#playlists tbody')
    if (!playlistTable) {
      console.warn('#playlists tbody not found for rendering.')
      return
    }

    playlistTable.innerHTML = ''

    if (!playlist || playlist.length === 0) {
      playlistTable.innerHTML =
        '<tr><td colspan="2" class="p-4 text-center text-gray-500 border-b">No playlists found.</td></tr>'
      return
    }

    playlist.forEach((playlist) => {
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

      playlistTable.appendChild(row)
    })
  }

  setupPlaylistClickHandler(onPlaylistSelect) {
    const playlistTable = document.querySelector('#playlists tbody')
    if (!playlistTable) {
      return
    }

    playlistTable.addEventListener('click', (event) => {
      const row = event.target.closest('tr')
      if (!row) {
        return
      }

      const playlistName = row.querySelector('td:first-child')?.textContent
      const playlist = this.findPlaylistByName(playlistName)

      if (playlist) {
        this.selectPlaylistRow(row)
        onPlaylistSelect(playlist)
      }
    })
  }

  selectPlaylistRow(selectedRow) {
    document
      .querySelectorAll('#playlists tbody tr.selected')
      .forEach((activeRow) => {
        activeRow.classList.remove('selected')
      })
    selectedRow.classList.add('selected')
  }

  findPlaylistByName(name) {
    return this.cachedPlaylist?.find((p) => p.name === name) || null
  }

  setCachedPlaylist(playlist) {
    this.cachedPlaylist = playlist
  }

  initTableSort() {
    const table = document.getElementById('playlists')
    if (table) {
      if (this.tableSort) {
        this.tableSort.destroy()
      }
      this.tableSort = new Tablesort(table)

      const header = table.querySelectorAll('th[role="columnheader"]')
      header.forEach((header) => {
        if (!header.hasAttribute('title')) {
          header.setAttribute('title', 'Click to sort')
        }
      })
    }
  }

  renderKeyword(keyword, filterMode, onRemoveKeyword) {
    const tagContainer = document.getElementById('tags')
    if (!tagContainer) {
      console.warn('#tags container not found for rendering keywords.')
      return
    }

    tagContainer.innerHTML = ''

    keyword.forEach((keyword, index) => {
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
        this.removeKeywordWithAnimation(index, onRemoveKeyword)
      }

      tag.appendChild(removeLink)
      tagContainer.appendChild(tag)
    })
  }

  removeKeywordWithAnimation(index, onRemove) {
    const tagContainer = document.getElementById('tags')
    const tagElement = tagContainer.querySelectorAll('.tag')
    const tagToRemove = tagElement[index]

    if (tagToRemove) {
      tagToRemove.classList.add('removing')
      setTimeout(() => {
        onRemove(index)
      }, window.SpotifyPlaylistFilter.config.ui.animationDelay)
    } else {
      onRemove(index)
    }
  }

  updateStartButtonVisibility(hasKeyword) {
    const startButton = document.getElementById('start-button')
    if (startButton) {
      if (hasKeyword) {
        startButton.classList.remove('hidden')
      } else {
        startButton.classList.add('hidden')
      }
    }
  }

  setStartButtonLoading(isLoading) {
    const startButton = document.getElementById('start-button')
    if (startButton) {
      startButton.disabled = isLoading
      if (isLoading) {
        startButton.classList.add('opacity-70')
      } else {
        startButton.classList.remove('opacity-70')
      }
    }
  }

  updateResultOutput(htmlContent) {
    const resultOutput = document.getElementById('result-output')
    if (resultOutput) {
      resultOutput.innerHTML = htmlContent
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

  showLoadingSpinner(message) {
    this
      .updateResultOutput(`<div class="flex items-center justify-center py-4 gap-3">
      <div class="inline-flex items-center justify-center w-6 h-6 border-2 border-t-transparent border-spotify-green rounded-full animate-spin" role="status"></div>
      <span class="text-gray-800"><i class="fas fa-rocket mr-2"></i>${message}</span>
    </div>`)
  }
}

window.SpotifyPlaylistFilter.UiManager = UiManager
