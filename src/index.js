let accessToken = null
let loggedIn = false
let uid
const selectedPlaylistSpotify = {
  id: '',
  name: '',
}
let tagCounter = 0
let tagAmountCounter = 0
const tags = []

const tokenManager = {
  setToken: function (token) {
    if (!token) {
      return false
    }

    accessToken = token

    try {
      sessionStorage.setItem('spotify_access_token', token)
      return true
    } catch (e) {
      console.error('Failed to store token in sessionStorage:', e)
      return true
    }
  },

  getToken: function () {
    if (accessToken) {
      return accessToken
    }

    try {
      const storedToken = sessionStorage.getItem('spotify_access_token')
      if (storedToken) {
        accessToken = storedToken
        return storedToken
      }
    } catch (e) {
      console.error('Failed to retrieve token from sessionStorage:', e)
    }

    return null
  },

  clearToken: function () {
    accessToken = null
    try {
      sessionStorage.removeItem('spotify_access_token')
    } catch (e) {
      console.error('Failed to clear token from sessionStorage:', e)
    }
  },

  hasToken: function () {
    return !!this.getToken()
  },
}

function sendErrorToUrl(msg) {
  console.log(msg)
  if (
    msg === 'invalid_access_token' ||
    msg === 'get_spotify' ||
    msg === 'send_to_spotify'
  ) {
    tokenManager.clearToken()
  }
  window.location = '/#error=' + msg
}

const API_BASE_URL = window.location.origin

$(document).ready(function () {
  const $loginBtn = $('#login-btn')
  if ($loginBtn.length) {
    $loginBtn.attr('href', API_BASE_URL + '/login')
  }
})

function navigationHandler(playlistForm, tagForm) {
  $('#login').hide()
  $('#logged-in').hide()
  $('#playlist-form').hide()
  $('#tag-form').hide()
  if (!loggedIn) {
    $('#login').show()
  } else {
    $('#logged-in').show()
    if (playlistForm) {
      $('#playlist-form').show()
    }

    if (tagForm) {
      $('#tag-form').show()
    }
  }
  if ($('#footer').css('display') === 'none') {
    $('#footer').css('display', 'inline-flex')
  }
}

function getSpotify(url, data) {
  return new Promise((resolve, reject) => {
    if (!tokenManager.hasToken()) {
      console.error('No access token available')
      console.log('Current token state:', {
        accessToken: !!accessToken,
        sessionStorageToken: !!sessionStorage.getItem('spotify_access_token'),
      })
      sendErrorToUrl('no_token_provided')
      reject(new Error('No token provided'))
      return
    }

    accessToken = tokenManager.getToken()
    console.log(
      'Using token (first 5 chars):',
      accessToken.substring(0, 5) + '...'
    )

    const queryString = Object.keys(data)
      .map(
        (key) => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`
      )
      .join('&')
    const fullUrl = `${url}?${queryString}`
    console.log('Making request to:', fullUrl)

    fetch(fullUrl, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
      },
    })
      .then((response) => {
        console.log('Response status:', response.status)
        if (response.status === 401) {
          console.error('Authentication failed with 401')
          tokenManager.clearToken()
          throw new Error('Token invalid or expired')
        }
        if (!response.ok) {
          throw new Error(`Network response was not ok: ${response.status}`)
        }
        return response.json()
      })
      .then((data) => resolve(data))
      .catch((error) => {
        console.error('Spotify API error:', error.message)
        if (error.message.includes('Token')) {
          sendErrorToUrl('invalid_access_token')
        } else {
          sendErrorToUrl('get_spotify')
        }
        reject(error)
      })
  })
}
async function getSpotifySets(url, data) {
  const allItems = []
  let offset = data.offset || 0
  const limit = data.limit
  let hasMoreData = true
  let requestCount = 0

  while (hasMoreData && offset < 10000) {
    try {
      requestCount++
      const requestData = {
        ...data,
        offset: offset,
      }

      const response = await getSpotify(url, requestData)
      const items = response.items
      if (items && items.length > 0) {
        allItems.push(...items)
        offset += limit

        if (items.length < limit) {
          hasMoreData = false
        }
      } else {
        hasMoreData = false
      }
    } catch (error) {
      console.error(`❌ Error fetching batch ${requestCount}:`, error)
      sendErrorToUrl('get_spotify_sets')
      break
    }
  }

  return [allItems]
}

async function * fetchTracksGenerator() {
  const url =
    'https://api.spotify.com/v1/users/' +
    uid +
    '/playlists/' +
    selectedPlaylistSpotify.id +
    '/tracks'

  let offset = 0
  const limit = 50
  let hasMoreData = true
  let batchCount = 0
  let totalFetched = 0
  console.log(
    `📥 Starting to fetch tracks from playlist: ${selectedPlaylistSpotify.name}`
  )

  while (hasMoreData && offset < 10000) {
    try {
      batchCount++
      console.log(`📡 Fetching tracks batch ${batchCount} (offset: ${offset})`)

      const data = {
        limit: limit,
        offset: offset,
        fields: 'items(track(name, artists(name), uri))',
      }

      const response = await getSpotify(url, data)
      const items = response.items
      if (items && items.length > 0) {
        const validTracks = items.filter(
          (val) => val?.track && val.track.artists?.length > 0 && val.track.name
        )

        totalFetched += validTracks.length
        console.log(
          `✅ Batch ${batchCount}: Got ${validTracks.length} valid tracks (total: ${totalFetched})`
        )

        for (const track of validTracks) {
          yield track
        }

        offset += limit

        if (items.length < limit) {
          hasMoreData = false
          console.log(
            `🏁 Reached end of playlist - total valid tracks: ${totalFetched}`
          )
        }
      } else {
        hasMoreData = false
        console.log(
          `🏁 No more tracks found - total valid tracks: ${totalFetched}`
        )
      }
    } catch (error) {
      console.error(`❌ Error fetching batch ${batchCount}:`, error)
      sendErrorToUrl('get_spotify_sets')
      break
    }
  }
}

function getHashParams() {
  const hashParams = {}
  const queryString = window.location.hash.substring(1)
  console.log('Processing hash string:', queryString)

  const pairs = queryString.split('&')
  for (const pair of pairs) {
    const [key, value] = pair.split('=')
    if (key && value) {
      hashParams[decodeURIComponent(key)] = decodeURIComponent(value)
    }
  }

  console.log('Hash params found:', {
    hasAccessToken: !!hashParams.access_token,
    accessTokenLength: hashParams.access_token
      ? hashParams.access_token.length
      : 0,
    hasUid: !!hashParams.uid,
  })

  return hashParams
}
async function login() {
  console.log('Login function called')

  if (tokenManager.hasToken()) {
    accessToken = tokenManager.getToken()
    console.log('Found existing token in tokenManager')
  } else {
    const params = getHashParams()

    if (params.access_token) {
      console.log('Found token in URL hash, saving it')
      tokenManager.setToken(params.access_token)
      accessToken = params.access_token
    } else {
      console.log('No token found in URL hash')
    }

    uid = params.uid
    if (uid) {
      console.log('Found uid in URL hash:', uid)
    }
  }
  console.log('Token status after initialization:', {
    hasToken: !!accessToken,
    hasUid: !!uid,
  })
  if (accessToken) {
    try {
      console.log('Validating token with Spotify API...')
      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.ok) {
        console.log('Token valid, setting logged in state')
        loggedIn = true
        navigationHandler(true, false)

        if (!uid) {
          const data = await response.json()
          uid = data.id
          console.log('Extracted uid from profile:', uid)
        }

        console.log('Fetching playlists...')
        const playlists = await fetchPlaylists(uid)
        if (playlists) {
          console.log('Rendering playlists')
          renderPlaylists(playlists)
        }
      } else {
        console.error('Invalid access token, response:', response.status)
        tokenManager.clearToken()
        throw new Error('Invalid access token')
      }
    } catch (error) {
      console.error('Authentication error:', error)

      tokenManager.clearToken()
      loggedIn = false
      navigationHandler(false, false)

      if ($('#login-error').length) {
        $('#login-error')
          .text('Authentication failed. Please try logging in again.')
          .show()
      } else {
        console.error('Login error element not found')
      }
    }
  } else {
    console.log('No access token found, showing login view')
    loggedIn = false
    navigationHandler(false, false)
  }
}

async function fetchPlaylists(uid) {
  console.log('Fetching playlists for user:', uid)
  const url = 'https://api.spotify.com/v1/users/' + uid + '/playlists'
  const data = {
    limit: 50,
    offset: 0,
  }

  try {
    const playlists = await getSpotifySets(url, data)
    console.log('Playlists data received:', playlists)

    if (!playlists || !playlists.length || !playlists[0].length) {
      console.error('No playlists found or empty playlist data')
    }

    return playlists
  } catch (error) {
    console.error('Error fetching playlists:', error)
    sendErrorToUrl('fetch_playlists')
    return null
  }
}

function renderPlaylists(playlists) {
  $('#playlists tbody').empty()
  let counter = 0
  $.each(playlists, function (index, val) {
    $.each(val, function (index, val) {
      $('#playlists')
        .find('tbody')
        .append(
          `<tr><td><a id='playlist-${counter}' spotify-id='${val.id}' spotify-name='${val.name}' href='#'>${val.name}</a></td><td>${val.tracks.total}</td></tr>`
        )
    })
    counter++
  })
}

async function fetchLyricsData(artist, song) {
  try {
    const searchResponse = await fetch(
      `${API_BASE_URL}/api/lyrics/search?artist=${encodeURIComponent(artist)}&song=${encodeURIComponent(song)}`
    )
    const searchData = await searchResponse.json()
    if (!searchData.found) {
      return null
    }
    const lyricsResponse = await fetch(
      `${API_BASE_URL}/api/lyrics/${searchData.songId}`
    )
    const lyricsData = await lyricsResponse.json()

    return lyricsData.lyrics
  } catch (error) {
    console.error('Error fetching lyrics:', error)
    return null
  }
}

function postSpotify(url, data) {
  return new Promise((resolve, reject) => {
    if (!tokenManager.hasToken()) {
      console.error('No access token available')
      sendErrorToUrl('no_token_provided')
      reject(new Error('No token provided'))
      return
    }

    accessToken = tokenManager.getToken()

    fetch(url, {
      method: 'POST',
      body: data,
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
      },
    })
      .then((response) => {
        if (response.status === 401) {
          tokenManager.clearToken()
          throw new Error('Token invalid or expired')
        }
        if (!response.ok) {
          throw new Error('Network response was not ok: ' + response.status)
        }
        return response.json()
      })
      .then((data) => resolve(data))

      .catch((error) => {
        console.error('Spotify API error:', error.message)
        if (error.message.includes('Token')) {
          sendErrorToUrl('invalid_access_token')
        } else {
          sendErrorToUrl('send_to_spotify')
        }
        reject(error)
      })
  })
}

async function createPlaylist(name) {
  const url = 'https://api.spotify.com/v1/users/' + uid + '/playlists'
  const data = JSON.stringify({
    name: name,
    public: 'false',
  })
  try {
    const playlist = await postSpotify(url, data)
    return playlist
  } catch (_error) {
    sendErrorToUrl('create_playlist')
    return null
  }
}

async function startFilteringStreaming() {
  const $resultOutput = $('#result-output')
  console.log('Result output: ', $resultOutput)

  $resultOutput.html('<br><span>🔄 Starting to process your playlist...</span>')

  try {
    $resultOutput.html('<br><span>📝 Creating filtered playlist...</span>')
    $resultOutput.html('<br><span>🔄 Processing and filtering tracks...</span>')

    let processedCount = 0
    let filteredCount = 0
    const allFilteredTracks = []

    console.log('🚀 Starting streaming filter process...')

    const trackGenerator = fetchTracksGenerator()
    let batch = []
    const BATCH_SIZE = 8

    for await (const track of trackGenerator) {
      batch.push(track)
      processedCount++

      if (batch.length === BATCH_SIZE) {
        const batchResults = await processBatch(batch, processedCount)
        allFilteredTracks.push(...batchResults.filtered)
        filteredCount += batchResults.filteredCount

        $resultOutput.html(
          `<br><span>🔄 Processed: ${processedCount} | Filtered: ${filteredCount} | Keeping: ${allFilteredTracks.length}</span>`
        )

        batch = []
      }
    }

    if (batch.length > 0) {
      const batchResults = await processBatch(batch, processedCount)
      allFilteredTracks.push(...batchResults.filtered)
      filteredCount += batchResults.filteredCount
    }

    console.log(
      `🎉 Processing completed: ${processedCount} processed, ${filteredCount} filtered, ${allFilteredTracks.length} keeping`
    )

    const playlist = await createPlaylist(
      selectedPlaylistSpotify.name + ' Filtered'
    )
    if (playlist == null) {
      sendErrorToUrl('create_playlist')
      return
    }
    const playlistId = playlist.id

    if (allFilteredTracks.length > 0) {
      $resultOutput.html('<br><span>📤 Adding tracks to playlist...</span>')
      await addAllTracksToPlaylist(allFilteredTracks, playlistId)

      $resultOutput.html(
        `<br><span>✅ Filtering complete! Removed ${filteredCount} tracks. Added ${allFilteredTracks.length} tracks to the filtered playlist.</span>`
      )
    } else {
      $resultOutput.html(
        '<br><span>⚠️ No tracks to add - all tracks were filtered out!</span>'
      )
    }
  } catch (error) {
    console.error('❌ Error during streaming filtering:', error)
    $resultOutput.html(
      '<br><span>❌ An error occurred during filtering. Please try again.</span>'
    )
  }
}

async function processBatch(batchTracks, totalProcessed) {
  const batchNumber = Math.ceil(totalProcessed / 8)
  console.log(
    `🎵 Processing batch ${batchNumber}: ${batchTracks.length} tracks in parallel`
  )

  const batchPromises = batchTracks.map(async (track) => {
    const artist = track.track.artists[0].name
    const song = track.track.name
    const uri = track.track.uri

    try {
      const lyrics = await fetchLyricsData(artist, song)

      if (lyrics) {
        const shouldFilter = tags.some((tag) =>
          lyrics.toLowerCase().includes(tag.toLowerCase())
        )

        if (shouldFilter) {
          console.log(`🚫 Filtered: ${artist} - ${song}`)
          return { filtered: true, uri, artist, song }
        } else {
          console.log(`✅ Keeping: ${artist} - ${song}`)
          return { filtered: false, uri, artist, song }
        }
      } else {
        console.log(`🚫 No lyrics found, filtering: ${artist} - ${song}`)
        return { filtered: true, uri, artist, song }
      }
    } catch (error) {
      console.error(`💥 Error processing ${artist} - ${song}:`, error)
      console.log(`🚫 Error occurred, filtering: ${artist} - ${song}`)
      return { filtered: true, uri, artist, song }
    }
  })

  const batchResults = await Promise.all(batchPromises)

  const filtered = []
  let filteredCount = 0

  batchResults.forEach((result) => {
    if (result.filtered) {
      filteredCount++
    } else {
      filtered.push({
        uri: result.uri,
        artist: result.artist,
        song: result.song,
      })
    }
  })

  console.log(
    `✅ Batch ${batchNumber} completed - Kept: ${filtered.length}, Filtered: ${filteredCount}`
  )

  await new Promise((resolve) => setTimeout(resolve, 200))

  return {
    filtered: filtered,
    filteredCount: filteredCount,
  }
}

async function addAllTracksToPlaylist(filteredTracks, playlistId) {
  const BATCH_SIZE = 50
  const uris = filteredTracks.map((track) => track.uri)

  console.log(`📦 Adding ${uris.length} tracks in batches of ${BATCH_SIZE}...`)

  for (let i = 0; i < uris.length; i += BATCH_SIZE) {
    const batch = uris.slice(i, i + BATCH_SIZE)
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(uris.length / BATCH_SIZE)

    console.log(
      `📤 Sending batch ${batchNumber}/${totalBatches} (${batch.length} tracks)...`
    )

    try {
      await addTrackBatchToPlaylist(batch, playlistId)
      console.log(`✅ Batch ${batchNumber}/${totalBatches} added successfully`)

      if (i + BATCH_SIZE < uris.length) {
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
    } catch (error) {
      console.error(
        `❌ Failed to add batch ${batchNumber}/${totalBatches}:`,
        error
      )
      throw error
    }
  }

  console.log(`🎉 All ${uris.length} tracks added to playlist successfully!`)
}

function addTrackBatchToPlaylist(uris, playlistId) {
  const url = `https://api.spotify.com/v1/users/${uid}/playlists/${playlistId}/tracks`
  const data = JSON.stringify({ uris })

  return new Promise((resolve, reject) => {
    fetch(url, {
      method: 'POST',
      body: data,
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
      },
    })
      .then((response) => {
        if (!response.ok) {
          console.error('Spotify API error:', {
            status: response.status,
            statusText: response.statusText,
          })
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        return response.json()
      })
      .then((data) => resolve(data))
      .catch((error) => {
        console.error('Spotify API error:', error)
        reject(error)
      })
  })
}

function createTag() {
  const tagInput = $('#tag-input').val()
  if (tagInput != null && !tags.includes(tagInput)) {
    if (tagCounter < 20) {
      if (tagCounter === 0) {
        $('#start-button').show()
      }
      $('#tags').append(
        "<span id='" +
          tagInput +
          "' class='tag bg-dark'>" +
          tagInput +
          "<a><i id='" +
          tagInput +
          "' class='fa fa-times remove'></i></a></span>"
      )
      tags.push(tagInput)
      tagCounter++
      tagAmountCounter++

      $('#tags').val('')
    }
  }
}

function removeTag(id) {
  $('#tags')
    .find('#' + id)
    .remove()
  const index = tags.indexOf(id)
  tags.splice(index, 1)
  tagAmountCounter--
  if (tagAmountCounter === 0) {
    $('#start-button').hide()
  }
}

$(function () {
  if ($('#login').length && $('#login-error').length === 0) {
    $('#login').prepend(
      '<div id="login-error" class="alert alert-danger" style="display:none;"></div>'
    )
  }

  const $loginBtn = $('#login-btn')
  if ($loginBtn.length) {
    $loginBtn.attr('href', API_BASE_URL + '/login')
  }

  login()

  $('#tag-input').on('keyup', function (event) {
    if (event.key === 'Enter') {
      createTag()
    }
  })

  $('#add-button').on('click', function () {
    createTag()
  })

  $('#start-button').on('click', function () {
    startFilteringStreaming()
  })

  $('#playlists').on('click', 'a', function () {
    selectedPlaylistSpotify.id = $(this).attr('spotify-id')
    selectedPlaylistSpotify.name = $(this).attr('spotify-name')
    if (selectedPlaylistSpotify.id) {
      navigationHandler(false, true)
    }
  })

  $('#tags').on('click', '.remove, .fa-times', function () {
    const id = $(this).attr('id')
    if (id) {
      removeTag(id)
      tagCounter--
    }
  })

  if (tagAmountCounter === 0) {
    $('#start-button').hide()
  }
})
