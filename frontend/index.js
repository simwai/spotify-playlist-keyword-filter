// Acts as the central "controller". It initializes everything,
// owns the application state, and defines all actions that can modify that state.

import AuthService from './services/auth-service.js'
import SpotifyApiService from './services/spotify-api-service.js'
import LyricsService from './services/lyrics-service.js'
import UiManager from './ui-manager.js'
import SpotifyPlaylistFilter from './spotify-playlist-filter.js'
import { createObservable } from './create-observable.js'

function main() {
  // --- 1. Constants & Services (No local dependencies) ---
  const filterModeEnum = { EXCLUDE: 'exclude', INCLUDE: 'include' }
  Object.freeze(filterModeEnum)

  const authService = new AuthService()
  const lyricsService = new LyricsService()
  const spotifyApiService = new SpotifyApiService(authService)
  const uiManager = new UiManager(spotifyApiService, authService)

  // --- 2. Rendering Function ---
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

  // --- 3. Central State ---
  const initialAppState = {
    keywords: [],
    filterMode: filterModeEnum.EXCLUDE,
    selectedPlaylist: null,
    playlists: [],
  }
  const appState = createObservable(initialAppState, () => renderApp())
  window.appState = appState

  // --- 4. State-Dependent Services ---
  const spotifyPlaylistFilter = new SpotifyPlaylistFilter(
    spotifyApiService,
    lyricsService,
    uiManager
  )

  // --- 5. Actions (The only functions that should modify appState) ---
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
    // Update the central state
    appState.selectedPlaylist = playlist

    // Update the UI to show the selection
    const allRows = document.querySelectorAll('#playlists tbody tr')
    for (const row of allRows) {
      row.classList.remove('selected')
    }
    rowElement.classList.add('selected')

    // Navigate to the next step
    uiManager.navigateTo('tag-form', { playlist })
  }

  // --- 6. Event Listener Registration ---
  const registerEventListeners = () => {
    document.getElementById('login-button')?.addEventListener('click', () => {
      window.location.href = '/login'
    })

    document.getElementById('add-button')?.addEventListener('click', addKeyword)

    document.getElementById('tag-input')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        addKeyword()
      }
    })

    // Event Delegation for removing keywords from the dynamic list
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

  // --- 7. App Initialization ---
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
    }
    renderApp(appState)
  }

  initializeApp()
}

document.addEventListener('DOMContentLoaded', main)
