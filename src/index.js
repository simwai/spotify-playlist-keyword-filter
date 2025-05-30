let accessToken
let loggedIn = false
let uid
const selectedPlaylistSpotify = {
  id: '',
  name: '',
}
let tagCounter = 0
let tagAmountCounter = 0
const tags = []

function sendErrorToUrl(msg) {
  console.log(msg)
  window.location = '/#error=' + msg
}

function refreshToken() {
  window.location = '/refresh_token'
}

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
    $.ajax(url, {
      dataType: 'json',
      data: data,
      headers: {
        Authorization: 'Bearer ' + accessToken,
      },
      success: function (response) {
        resolve(response)
      },
      error: function (_response) {
        sendErrorToUrl('get_spotify')
        reject(new Error('get_spotify'))
      },
    })
  })
}

// Unified pagination function for playlists
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

  return [allItems] // Keep original return format
}

async function* fetchTracksGenerator() {
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
  // For browser compatibility, use manual parsing instead of URLSearchParams
  const pairs = queryString.split('&')
  for (const pair of pairs) {
    const [key, value] = pair.split('=')
    if (key && value) {
      hashParams[decodeURIComponent(key)] = decodeURIComponent(value)
    }
  }
  return hashParams
}

async function login() {
  const params = getHashParams()
  accessToken = params.access_token
  uid = params.uid
  if (accessToken) {
    try {
      const response = await fetch('https://api.spotify.com/v1/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      if (response.ok) {
        loggedIn = true
        navigationHandler(true, false)
        const playlists = await fetchPlaylists(uid)
        if (playlists && playlists.length !== 0) {
          renderPlaylists(playlists)
        }
      } else {
        throw new Error('Invalid access token')
      }
    } catch (error) {
      sendErrorToUrl('invalid_access_token')
      refreshToken()
    }
  } else {
    loggedIn = false
    navigationHandler(false, false)
  }
}

async function fetchPlaylists(uid) {
  const url = 'https://api.spotify.com/v1/users/' + uid + '/playlists'
  const data = {
    limit: 50,
    offset: 0,
  }
  const playlists = await getSpotifySets(url, data)
  if (playlists == null) {
    sendErrorToUrl('fetch_playlists')
  }
  return playlists
}

function renderPlaylists(playlists) {
  $('#playlists tbody').empty()
  let counter = 0
  $.each(playlists, function (index, val) {
    $.each(val, function (index, val) {
      $('#playlists')
        .find('tbody')
        .append(
          "<tr><td><a id='playlist-" +
            counter +
            "' spotify-id='" +
            val.id +
            "' spotify-name='" +
            val.name +
            "' href='#'>" +
            val.name +
            '</a></td><td>' +
            val.tracks.total +
            '</td></tr>'
        )
    })
    counter++
  })
}

// Consolidated lyrics fetching functions
async function fetchLyricsData(artist, song) {
  try {
    // Get song ID
    const searchResponse = await fetch(
      `/api/lyrics/search?artist=${encodeURIComponent(artist)}&song=${encodeURIComponent(song)}`
    )
    const searchData = await searchResponse.json()

    if (!searchData.found) {
      return null
    }

    // Get lyrics
    const lyricsResponse = await fetch(`/api/lyrics/${searchData.songId}`)
    const lyricsData = await lyricsResponse.json()

    if (lyricsResponse.ok && lyricsData.lyrics) {
      return lyricsData.lyrics
    } else {
      console.log('No lyrics found')
      return null
    }
  } catch (error) {
    console.log('Error fetching lyrics:', error)
    return null
  }
}

function postSpotify(url, data) {
  return new Promise((resolve, reject) => {
    $.ajax(url, {
      method: 'POST',
      data: data,
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
      },
      success: function (response) {
        resolve(response)
      },
      error: function (_response) {
        sendErrorToUrl('send_to_spotify')
        reject(new Error('send_to_spotify'))
      },
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
  } catch (e) {
    sendErrorToUrl('create_playlist')
    return null
  }
}

// STREAMING FILTERING FUNCTION WITH PARALLEL PROCESSING
async function startFilteringStreaming() {
  $('#result-output').html(
    '<br><span>🔄 Starting to process your playlist...</span>'
  )

  try {
    // Create the filtered playlist first
    $('#result-output').html(
      '<br><span>📝 Creating filtered playlist...</span>'
    )
    const playlist = await createPlaylist(
      selectedPlaylistSpotify.name + ' Filtered'
    )
    if (playlist == null) {
      sendErrorToUrl('create_playlist')
      return
    }
    const playlistId = playlist.id

    $('#result-output').html(
      '<br><span>🔄 Processing and filtering tracks...</span>'
    )

    let processedCount = 0
    let filteredCount = 0
    const allFilteredTracks = [] // Collect all tracks that pass the filter

    console.log('🚀 Starting streaming filter process...')

    // Process tracks in parallel batches
    const trackGenerator = fetchTracksGenerator()
    let batch = []
    const BATCH_SIZE = 8 // Process 8 tracks in parallel

    for await (const track of trackGenerator) {
      batch.push(track)
      processedCount++

      // Process batch when it's full
      if (batch.length === BATCH_SIZE) {
        const batchResults = await processBatch(batch, processedCount)
        allFilteredTracks.push(...batchResults.filtered)
        filteredCount += batchResults.filteredCount

        // Update UI
        $('#result-output').html(
          `<br><span>🔄 Processed: ${processedCount} | Filtered: ${filteredCount} | Keeping: ${allFilteredTracks.length}</span>`
        )

        batch = [] // Reset batch
      }
    }

    // Process remaining tracks in the last batch
    if (batch.length > 0) {
      const batchResults = await processBatch(batch, processedCount)
      allFilteredTracks.push(...batchResults.filtered)
      filteredCount += batchResults.filteredCount
    }

    console.log(
      `🎉 Processing completed: ${processedCount} processed, ${filteredCount} filtered, ${allFilteredTracks.length} keeping`
    )

    // Now add all filtered tracks to the playlist in batches
    if (allFilteredTracks.length > 0) {
      $('#result-output').html(
        '<br><span>📤 Adding tracks to playlist...</span>'
      )
      await addAllTracksToPlaylist(allFilteredTracks, playlistId)

      $('#result-output').html(
        `<br><span>✅ Filtering complete! Removed ${filteredCount} tracks. Added ${allFilteredTracks.length} tracks to the filtered playlist.</span>`
      )
    } else {
      $('#result-output').html(
        '<br><span>⚠️ No tracks to add - all tracks were filtered out!</span>'
      )
    }
  } catch (error) {
    console.error('❌ Error during streaming filtering:', error)
    $('#result-output').html(
      '<br><span>❌ An error occurred during filtering. Please try again.</span>'
    )
  }
}

// Process a batch of tracks in parallel
async function processBatch(batchTracks, totalProcessed) {
  const batchNumber = Math.ceil(totalProcessed / 8)
  console.log(
    `🎵 Processing batch ${batchNumber}: ${batchTracks.length} tracks in parallel`
  )

  // Process all tracks in this batch simultaneously
  const batchPromises = batchTracks.map(async (track) => {
    const artist = track.track.artists[0].name
    const song = track.track.name
    const uri = track.track.uri

    try {
      // Fetch lyrics for this track
      const lyrics = await fetchLyricsData(artist, song)

      if (lyrics) {
        // Check if track should be filtered (case-insensitive search)
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
        // No lyrics found, filter out the track
        console.log(`🚫 No lyrics found, filtering: ${artist} - ${song}`)
        return { filtered: true, uri, artist, song }
      }
    } catch (error) {
      console.error(`💥 Error processing ${artist} - ${song}:`, error)
      // Filter out track if lyrics fetch fails
      console.log(`🚫 Error occurred, filtering: ${artist} - ${song}`)
      return { filtered: true, uri, artist, song }
    }
  })

  // Wait for all tracks in this batch to complete
  const batchResults = await Promise.all(batchPromises)

  // Separate filtered and kept tracks
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

  // Small delay between batches to avoid overwhelming the APIs
  await new Promise((resolve) => setTimeout(resolve, 200))

  return {
    filtered: filtered,
    filteredCount: filteredCount,
  }
}

// Improved function to add all tracks in batches of 50
async function addAllTracksToPlaylist(filteredTracks, playlistId) {
  const BATCH_SIZE = 50 // Spotify limit
  const uris = filteredTracks.map((track) => track.uri)

  console.log(`📦 Adding ${uris.length} tracks in batches of ${BATCH_SIZE}...`)

  // Split URIs into chunks of 50
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

      // Small delay between batches to be nice to Spotify's API
      if (i + BATCH_SIZE < uris.length) {
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
    } catch (error) {
      console.error(
        `❌ Failed to add batch ${batchNumber}/${totalBatches}:`,
        error
      )
      throw error // Stop if a batch fails
    }
  }

  console.log(`🎉 All ${uris.length} tracks added to playlist successfully!`)
}

// Function to add a single batch to playlist (similar to your original but with better error handling)
function addTrackBatchToPlaylist(uris, playlistId) {
  const url = `https://api.spotify.com/v1/users/${uid}/playlists/${playlistId}/tracks`
  const data = JSON.stringify({ uris })

  return new Promise((resolve, reject) => {
    $.ajax(url, {
      method: 'POST',
      data: data,
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
      },
      success: function (response) {
        resolve(response)
      },
      error: function (xhr, status, error) {
        console.error('Spotify API error:', {
          status: xhr.status,
          statusText: xhr.statusText,
          responseText: xhr.responseText,
        })
        reject(error)
      },
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
  login()
  $('keyup', function (_event) {
    if ($('#tag-input').is(':focus') && _event.key === 'Enter') {
      createTag()
    }
  })
  $('#tags').on('click', function (_event) {
    const val = _event.target.id
    if (val != null) {
      removeTag(val)
      tagCounter--
    }
  })
  $('#playlists').on('click', function (event) {
    const selectedPlaylistId = event.target.id.match(/\d+/)
    selectedPlaylistSpotify.name = event.target.getAttribute('spotify-name')
    selectedPlaylistSpotify.id = event.target.getAttribute('spotify-id')
    if (selectedPlaylistId) {
      navigationHandler(false, true)
    }
  })
  $('#add-button').on('click', function (_event) {
    createTag()
  })
  $('#start-button').on('click', function (_event) {
    startFilteringStreaming() // Use the new streaming function
  })
})

/* TODO:
    better seperate functions (calls)
    remove unnecessary global vars
    lyrics cache
    anonymous proxy requests
    avoid google index
    little access statistic
*/
