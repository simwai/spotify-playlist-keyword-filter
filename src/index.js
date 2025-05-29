let accessToken;
let loggedIn = false;

let uid;
const selectedPlaylistSpotify = {
  id: "",
  name: "",
};
let tagCounter = 0;
let tagAmountCounter = 0;
const tags = [];

function sendErrorToUrl(msg) {
  console.log(msg);
  window.location = "/#error=" + msg;
}

function refreshToken() {
  window.location = "/refresh_token";
}

function navigationHandler(playlistForm, tagForm) {
  $("#login").hide();
  $("#logged-in").hide();
  $("#playlist-form").hide();
  $("#tag-form").hide();

  if (!loggedIn) {
    $("#login").show();
  } else {
    $("#logged-in").show();

    if (playlistForm) {
      $("#playlist-form").show();
    }

    if (tagForm) {
      $("#tag-form").show();
    }
  }

  if ($("#footer").css("display") == "none") {
    $("#footer").css("display", "inline-flex");
  }
}

function getSpotify(url, data) {
  return new Promise((resolve, reject) => {
    $.ajax(url, {
      dataType: "json",
      data: data,
      headers: {
        Authorization: "Bearer " + accessToken,
      },
      success: function (r) {
        resolve(r);
      },
      error: function (r) {
        sendErrorToUrl("get_spotify");
        reject("get_spotify");
      },
    });
  });
}

async function getSpotifySets(url, data) {
  let counter = 0;
  const items = [];
  const increase = data.limit;

  do {
    try {
      const set = (await getSpotify(url, data)).items;

      items.push(set);

      counter += increase;
      data.offset += increase;
    } catch (error) {
      sendErrorToUrl("get_spotify_sets");
      break;
    }
  } while (counter < 5000 && items.length > 99);

  return items;
}
function getHashParams() {
  const hashParams = {};
  const queryString = window.location.hash.substring(1);
  const params = new URLSearchParams(queryString);
  for (const [key, value] of params) {
    hashParams[key] = value;
  }
  return hashParams;
}

async function login() {
  const params = getHashParams();
  accessToken = params.access_token;
  uid = params.uid;

  if (accessToken) {
    try {
      const response = await fetch("https://api.spotify.com/v1/me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        loggedIn = true;
        navigationHandler(true, false);

        const playlists = await fetchPlaylists(uid);
        if (playlists && playlists.length !== 0) {
          renderPlaylists(playlists);
        }
      } else {
        throw new Error("Invalid access token");
      }
    } catch (error) {
      sendErrorToUrl("invalid_access_token");
      refreshToken();
    }
  } else {
    loggedIn = false;
    navigationHandler(false, false);
  }
}

async function fetchPlaylists(uid) {
  const url = "https://api.spotify.com/v1/users/" + uid + "/playlists";
  const data = {
    limit: 50,
    offset: 0,
  };

  const playlists = await getSpotifySets(url, data);

  if (playlists == null) {
    sendErrorToUrl("fetch_playlists");
  }

  return playlists;
}

function renderPlaylists(playlists) {
  $("#playlists tbody").empty();

  let counter = 0;
  $.each(playlists, function (index, val) {
    $.each(val, function (index, val) {
      $("#playlists")
        .find("tbody")
        .append(
          "<tr><td><a id='playlist-" +
            counter +
            "' spotify-id='" +
            val.id +
            "' spotify-name='" +
            val.name +
            "' href='#'>" +
            val.name +
            "</a></td><td>" +
            val.tracks.total +
            "</td></tr>"
        );
    });

    counter++;
  });
}

async function fetchSongId(artist, song) {
  const accessToken =
    "ffGgxwzDuaN9PxVUR8kBCue0q-oWMyWPMzXUmASOsCEEMorDGUHgeo8kkmTOmdHA";
  const searchTerm = song + " " + artist;

  const searchUrl = `/proxy/http://api.genius.com/search?access_token=${accessToken}&q=${encodeURIComponent(
    searchTerm
  )}`;

  return fetch(searchUrl, {
    headers: {
      "Access-Control-Allow-Origin": "*"
    }
  })
    .then((response) => {
      return response.json();
    })
    .then((data) => {
      const searchResults = data.response.hits;

      if (searchResults.length > 0) {
        const songId = searchResults[0].result.id;
        console.log("Song ID:", songId);
        return songId;
      } else {
        console.log("No results found.");
      }
    })
    .catch((_error) => {
      sendErrorToUrl("fetch_song_id");
      return null;
    });
}

async function fetchLyrics(artist, song) {
  const songId = await fetchSongId(artist, song);
  try {
    const url = "/proxy/http://genius.com/songs/" + songId;
    const lyricsResponse = await fetch(url, {
      headers: {
        accept: "*/*",
        "accept-encoding": "gzip, deflate, br",
        "accept-language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
        "cache-control": "max-age=0",
        connection: "keep-alive",
        host: "genius.com"
      },
    });
    const html = await lyricsResponse.text();
    if (!html) {
      throw new Error("No html in response for fetching lyrics");
    }
    const domParser = new DOMParser();
    const doc = domParser.parseFromString(html, "text/html");
    const lyricsEle = doc.querySelector(".lyrics");
    if (!lyricsEle) {
      throw new Error("Not found genius lyrics element");
    }
    const text = lyricsEle.innerText;
    return text;
  } catch (error) {
    console.log(error);
    sendErrorToUrl("fetch_lyrics");
    return null;
  }
}

async function fetchTracks() {
  const url =
    "https://api.spotify.com/v1/users/" +
    uid +
    "/playlists/" +
    selectedPlaylistSpotify.id +
    "/tracks";
  const data = {
    limit: 100,
    offset: 0,
    fields: "items(track(name, artists(name), uri))",
  };

  const tracks = await getSpotifySets(url, data);

  return tracks;
}

// function formatAZLyricsParams(artist, song) {
//   /*
//     if (song.includes("&")) {
//         song = song.replace("$", "And");
//     }
//     */

//   if (artist.includes(" ")) {
//     artist = artist.replace(/ /g, "");
//   }

//   if (artist.includes("$")) {
//     artist = artist.replace(/[$]/g, "S");
//   }

//   if (artist.includes(".")) {
//     artist = artist.replace(/[.]/g, "");
//   }

//   if (artist.includes("&")) {
//     artist = artist.replace(/(&).*/g, "");
//   }

//   if (song.includes(" ")) {
//     song = song.replace(/ /g, "");
//   }

//   if (song.includes(".")) {
//     song = song.replace(/[.]/g, "");
//   }

//   if (song.includes("(")) {
//     song = song.replace(/(\().*(\))/g, "");
//   }

//   if (song.includes(",")) {
//     song = song.replace(",", "");
//   }

//   if (song.includes("'")) {
//     song = song.replace("'" / g, "");
//   }

//   // individual case
//   if (song.includes("-lpmix")) {
//     song = song.replace(/(-lpmix)/g, "");
//   }

//   artist = artist.toLowerCase();
//   song = song.toLowerCase();

//   return {
//     song: song,
//     artist: artist,
//   };
// }

async function fetchAllLyrics(tracks) {
  const lyricsArr = [];
  let requestCounter = 0;

  for (const val of tracks[0]) {
    const artist = val.track.artists[0].name;
    const song = val.track.name;
    const uri = val.track.uri;

    const lyrics = await fetchLyrics(artist, song);

    if (lyrics == null) {
      sendErrorToUrl("fetch_all_lyrics");
      return null;
    }

    const data = {
      lyrics: lyrics,
      uri: uri,
    };

    lyricsArr.push(data);
    requestCounter++;

    if (requestCounter == 20) {
      break;
    }
  }

  console.log(lyricsArr);
  return lyricsArr;
}

function filterPlaylist(lyrics) {
  let filtered = false;
  console.log(lyrics);
  $.each(lyrics, function (index, val1) {
    if (val1 == null) {
      console.log("skipped");
      return true;
    }

    $.each(tags, function (index, val2) {
      // console.log("val1: " + JSON.stringify(val1) + "val2: " + val2);

      console.log("val1 ^^^^^", val1);
      console.log("val2 ^^^^^", val2);
      console.log("BEFORE ||||||", lyrics);

      if (val1?.lyrics.includes(val2)) {
        lyrics.splice(lyrics.indexOf(val2), 1);
        console.log("AFTERRR ||||||", lyrics);
        filtered = true;
      }
    });
  });

  if (filtered) {
    console.log(lyrics);
    // Return filtered playlist
    return lyrics;
  } else {
    console.log("false");
    return false;
  }
}

function postSpotify(url, data) {
  return new Promise((resolve, reject) => {
    $.ajax(url, {
      method: "POST",
      data: data,
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
      success: function (r) {
        resolve(r);
      },
      error: function (r) {
        sendErrorToUrl("send_to_spotify");
        reject("send_to_spotify");
      },
    });
  });
}

async function createPlaylist(name) {
  const url = "https://api.spotify.com/v1/users/" + uid + "/playlists";
  const data = JSON.stringify({
    name: name,
    public: "false",
  });

  try {
    const playlist = await postSpotify(url, data);
    return playlist;
  } catch (e) {
    sendErrorToUrl("create_playlist");
    return null;
  }
}

function addTracksToPlaylist(filteredPlaylist, playlistId) {
  const url =
    "https://api.spotify.com/v1/users/" +
    uid +
    "/playlists/" +
    playlistId +
    "/tracks";

  const uriArr = [];
  $.each(filteredPlaylist, function (index, val) {
    uriArr.push(val.uri);
  });

  var data = JSON.stringify({
    uris: uriArr,
  });

  postSpotify(url, data).catch(function (e) {
    sendErrorToUrl("create_playlist");
  });
}

async function startFiltering() {
  const tracks = await fetchTracks();

  if (tracks.length != 0) {
    const lyrics = await fetchAllLyrics(tracks);

    if (lyrics == null) {
      console.log("filtering failed");
      return;
    }

    const filteredPlaylist = filterPlaylist(lyrics);

    if (!filteredPlaylist) {
      $("#result-output").html(
        "<br><span>Your playlist is already filtered! No keyword found.</span>"
      );
    } else {
      const playlist = await createPlaylist(
        selectedPlaylistSpotify.name + " Filtered"
      );

      if (playlist == null) {
        sendErrorToUrl("create_playlist");
        return null;
      }

      const playlistId = playlist.id;
      addTracksToPlaylist(filteredPlaylist, playlistId);

      $("#result-output").html(
        "<br><span>Your playlist is filtered now! You find the songs in the new playlist of your Spotify account."
      );
    }
  }
}

// on event start
function createTag() {
  const tagInput = $("#tag-input").val();

  if (tagInput != null && !tags.includes(tagInput)) {
    if (tagCounter < 20) {
      if (tagCounter == 0) {
        $("#start-button").show();
      }

      $("#tags").append(
        "<span id='" +
          tagInput +
          "' class='tag bg-dark'>" +
          tagInput +
          "<a><i id='" +
          tagInput +
          "' class='fa fa-times remove'></i></a></span>"
      );
      tags.push(tagInput);
      tagCounter++;
      tagAmountCounter++;
    }
  }
}

function removeTag(id) {
  $("#tags")
    .find("#" + id)
    .remove();

  const index = tags.indexOf(id);
  tags.splice(index, 1);

  tagAmountCounter--;

  if (tagAmountCounter == 0) {
    $("#start-button").hide();
  }
}

$(function () {
  login();

  $("keyup", function (event) {
    if ($("#tag-input").is(":focus") && event.key == "Enter") {
      createTag();
    }
  });

  $("#tags").on("click", function (event) {
    // var id = event.target.id.match(/\d+/);
    const val = event.target.id;

    if (val != null) {
      // removeTag(id[0]);
      removeTag(val);
      tagCounter--;
    }
  });

  // hide playlist-form, show tag-form
  $("#playlists").on("click", function (event) {
    const selectedPlaylistId = event.target.id.match(/\d+/);
    selectedPlaylistSpotify.name = event.target.getAttribute("spotify-name");
    selectedPlaylistSpotify.id = event.target.getAttribute("spotify-id");

    if (selectedPlaylistId) {
      navigationHandler(false, true);
    }
  });

  $("#add-button").on("click", function (event) {
    createTag();
  });
  $("#start-button").on("click", function (event) {
    startFiltering();
  });
});

/* TODO:
    better seperate functions (calls)
    remove unnecessary global vars

    lyrics cache
    anonymous proxy requests
    avoid google index
    little access statistic
*/
