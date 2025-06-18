import AuthService from './services/auth-service.js'
import SpotifyApiService from './services/spotify-api-service.js'
import LyricsService from './services/lyrics-service.js'
import UiManager from './ui-manager.js'
import SpotifyPlaylistFilter from './spotify-playlist-filter.js'
import { createObservable } from './create-observable.js'

function main() {
  const filterModeEnum = { EXCLUDE: 'exclude', INCLUDE: 'include' }
  Object.freeze(filterModeEnum)

  const authService = new AuthService()
  const lyricsService = new LyricsService()
  const spotifyApiService = new SpotifyApiService(authService)
  const uiManager = new UiManager(spotifyApiService, authService)

  const renderApp = () => {
    const state = window.appState
    if (!state) {
      return
    }

    uiManager.renderKeywords(state.keywords, state.filterMode)

    const startButton = document.getElementById('start-button')
    if (startButton) {
      startButton.classList.toggle('hidden', state.keywords.length === 0)
    }
  }

  const initialAppState = {
    keywords: [],
    filterMode: filterModeEnum.EXCLUDE,
    selectedPlaylist: null,
    playlists: [],
  }
  const appState = createObservable(initialAppState, () => renderApp())
  window.appState = appState

  const spotifyPlaylistFilter = new SpotifyPlaylistFilter(
    spotifyApiService,
    lyricsService,
    uiManager
  )

  const addKeyword = () => {
    const tagInput = document.getElementById('tag-input')
    const newKeyword = tagInput.value.trim().toLowerCase()
    if (newKeyword && !appState.keywords.includes(newKeyword)) {
      appState.keywords.push(newKeyword)
      tagInput.value = ''
    }
  }

  const removeKeyword = (indexToRemove) => {
    if (indexToRemove >= 0 && indexToRemove < appState.keywords.length) {
      appState.keywords.splice(indexToRemove, 1)
    }
  }

  const selectPlaylist = (playlist, rowElement) => {
    appState.selectedPlaylist = playlist

    const allRows = document.querySelectorAll(
      '#playlists > div:nth-child(2) > div'
    )
    for (const row of allRows) {
      row.classList.remove('bg-green-50', 'border-l-3', 'border-l-green-500')
    }
    rowElement.classList.add('bg-green-50', 'border-l-3', 'border-l-green-500')

    uiManager.navigateTo('tag-form', { playlist })
  }

  const clearInputErrors = () => {
    const clientIdInput = document.getElementById('spotify-client-id')
    const clientSecretInput = document.getElementById('spotify-client-secret')

    clientIdInput?.classList.remove(
      'border-red-500',
      'focus:ring-red-500',
      'focus:border-red-500'
    )
    clientSecretInput?.classList.remove(
      'border-red-500',
      'focus:ring-red-500',
      'focus:border-red-500'
    )
  }

  const addInputError = (inputElement) => {
    inputElement?.classList.add(
      'border-red-500',
      'focus:ring-red-500',
      'focus:border-red-500'
    )
  }

  const handleLogin = () => {
    const clientIdInput = document.getElementById('spotify-client-id')
    const clientSecretInput = document.getElementById('spotify-client-secret')
    const clientId = clientIdInput.value.trim()
    const clientSecret = clientSecretInput.value.trim()

    clearInputErrors()

    const hasErrors = false

    if (!clientId) {
      addInputError(clientIdInput)
      clientIdInput.focus()
      uiManager.showError('Please enter your Spotify Client ID')
      return
    }

    if (!/^[a-f0-9]{32}$/i.test(clientId)) {
      addInputError(clientIdInput)
      clientIdInput.focus()

      uiManager.showError(
        'Invalid Client ID format. Should be 32 characters (letters and numbers)'
      )
      return
    }
    if (!clientSecret) {
      addInputError(clientSecretInput)
      if (!hasErrors) {
        clientSecretInput.focus()
      }
      uiManager.showError('Please enter your Spotify Client Secret')
      return
    }

    if (!/^[a-f0-9]{32}$/i.test(clientSecret)) {
      addInputError(clientSecretInput)
      if (!hasErrors) {
        clientSecretInput.focus()
      }
      uiManager.showError(
        'Invalid Client Secret format. Should be 32 characters (letters and numbers)'
      )
      return
    }

    try {
      authService.setCredentials(clientId, clientSecret)

      const params = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
      })

      window.location.href = `/login?${params.toString()}`
    } catch (error) {
      console.error('❌ Credential save failed:', error)
      uiManager.showError(`Failed to save credentials: ${error.message}`)
    }
  }

  const registerEventListeners = () => {
    document
      .getElementById('login-button')
      ?.addEventListener('click', handleLogin)

    document.getElementById('add-button')?.addEventListener('click', addKeyword)

    document.getElementById('tag-input')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        addKeyword()
      }
    })

    document.getElementById('tags')?.addEventListener('click', (event) => {
      const removeButton = event.target.closest('.remove-tag')
      if (removeButton) {
        event.preventDefault()
        const index = parseInt(removeButton.dataset.index, 10)
        removeKeyword(index)
      }
    })

    document.getElementById('start-button')?.addEventListener('click', () => {
      spotifyPlaylistFilter.initializeFilterProcess()
    })

    document.querySelectorAll('input[name="filter-mode"]')?.forEach((input) => {
      input.addEventListener('change', (event) => {
        appState.filterMode = event.target.value
      })
    })

    document
      .getElementById('back-to-playlists-button')
      ?.addEventListener('click', () => {
        uiManager.navigateTo('playlist-selection')
      })
  }

  const populateCredentialInputs = () => {
    const clientIdInput = document.getElementById('spotify-client-id')
    const clientSecretInput = document.getElementById('spotify-client-secret')
    const storedClientId = authService.getClientId()
    const storedClientSecret = authService.getClientSecret()

    if (clientIdInput && storedClientId) {
      clientIdInput.value = storedClientId
    }

    if (clientSecretInput && storedClientSecret) {
      clientSecretInput.value = storedClientSecret
    }
  }

  const initializeApp = async () => {
    registerEventListeners()
    authService.parseUrlParams()

    if (authService.accessToken) {
      uiManager.navigateTo('logged-in')

      await uiManager.loadPlaylists()

      appState.playlists = uiManager.playlists

      uiManager.renderPlaylists(selectPlaylist, appState.selectedPlaylist)
    } else {
      uiManager.navigateTo('login')
      populateCredentialInputs()
    }

    renderApp(appState)
  }

  initializeApp()
}

document.addEventListener('DOMContentLoaded', main)
