var access_token;
var loggedIn = false;

var uid;
var selectedPlaylistSpotify = {
    "id": "",
    "name": ""
}
var tagCounter = 0;
var tagAmountCounter = 0;
var tags = [];

function error(msg) {
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
                "Authorization": "Bearer " + access_token
            },
            success: function (r) {
                resolve(r);
            },
            error: function (r) {
                error("get_spotify");
                reject("get_spotify");
            }
        });
    });
}

async function getSpotifySets(url, data) {
    var counter = 0;
    var items = [];
    var increase = data.limit;

    do {
        try {
            var response = await getSpotify(url, data);
            var set = response.items;

            items.push(set);

            counter += increase;
            data.offset += increase;
        } catch (e) {
            error("get_spotify_sets");
            break;
        }
    } while (counter < 5000 && items.length > 99);

    return items;
}

function getHashParams() {
    var hashParams = {};
    var e, r = /([^&;=]+)=?([^&;]*)/g,
        q = window.location.hash.substring(1);
    while (e = r.exec(q)) {
        hashParams[e[1]] = decodeURIComponent(e[2]);
    }

    return hashParams;
}

function login() {
    var params = getHashParams();
    access_token = params.access_token;
    // var refresh_token = params.refresh_token;
    uid = params.uid;
    // var error = params.error;

    if (access_token) {
        $.ajax({
            url: "https://api.spotify.com/v1/me",
            headers: {
                "Authorization": "Bearer " + access_token
            },
            success: function (r) {
                loggedIn = true;
                navigationHandler(true, false);

                var playlists = (async function () {
                    var playlists = await fetchPlaylists(uid);
                    if (playlists.length != 0) {
                        renderPlaylists(playlists);
                    }
                })();
            },
            error: function (r) {
                error("invalid_access_token");
                refreshToken();
            }
        });
    } else {
        loggedIn = false;
        // render initial screen
        navigationHandler(false, false);
    }
}

async function fetchPlaylists(uid) {
    var url = "https://api.spotify.com/v1/users/" + uid + "/playlists";
    var data = {
        limit: 50,
        offset: 0
    }

    var playlists = await getSpotifySets(url, data);

    if (playlists == null) {
        error("fetch_playlists");
    }

    return playlists;
}

function renderPlaylists(playlists) {
    $("#playlists tbody").empty();

    var counter = 0;
    $.each(playlists, function (index, val) {
        $.each(val, function (index, val) {
            $("#playlists").find("tbody").append("<tr><td><a id='playlist-" + counter + "' spotify-id='" + val.id + "' spotify-name='" + val.name + "' href='#'>" + val.name + "</a></td><td>" + val.tracks.total + "</td></tr>");
        })

        counter++;
    })
}

// function getRandomProxy(option) {
//     var url = "";
//     var dataType = "";

//     if (option == 1) {
//         url = "http://pubproxy.com/api/proxy";
//         dataType = "json";
//     }

//     if (option == 2) {
//         url = "http://localhost:8011/proxy/api/v1/get?type=http&anon=anonymous";
//         dataType = "text/plain";
//     }

//     if (option == 3) {
//         url = "https://api.getproxylist.com/proxy";
//         dataType = "json";
//     }

//     if (option == 4) {
//         url ="http://localhost:8888/randomProxies";
//         dataType="json";
//     }

//     return new Promise((resolve, reject) => {
//         $.ajax({
//             url: url,
//             dataType: dataType,
//             success: function (r) {
//                 console.log("random proxy success", r);             

//                 var ip = "";
//                 if (option == 1) {
//                     ip = r[0].ipPort;
//                 }

//                 if (option == 2) {
//                     ip = r.responseText.split("\n")[1];
//                 }

//                 if (option == 3) {
//                     ip = r.ip + ":" + r.port;
//                 }       
                
//                 if (option == 4) {
//                     ip = r.ipPort;
//                 }

//                 resolve(ip);
//             },
//             error: function (r) {
//                 error("get_random_proxy");
//                 reject(r);
//             }
//         })
//     });
// }

async function getAZLyrics(artist, song) {
    var res = $.ajax({
        //url: "http://localhost:8010/proxy/lyrics/"  + artist + "/" + song + ".html",
        url: "http://localhost:8888/proxy/lyrics/"  + artist + "/" + song + ".html",
        crossDomain: false,
        processData: false,
        success: function (r) {
            return r;
        },
        error: function (r) {
            error("get_azlyrics");
            return r;
        }
    });

    return res;
}

async function fetchTracks() {
    var url = "https://api.spotify.com/v1/users/" + uid + "/playlists/" + selectedPlaylistSpotify.id + "/tracks";
    var data = {
        limit: 100,
        offset: 0,
        fields: "items(track(name, artists(name), uri))"
    }

    var tracks = await getSpotifySets(url, data);

    return tracks;
}

function formatAZLyricsParams(artist, song) {
    // sampe the great artis not available
    // And or The if The at the beginning
    // can be And or &
    /*
    if (song.includes("&")) {
        song = song.replace("$", "And");
    }
    */

    if (artist.includes(" ")) {
        artist = artist.replace(/ /g, "");
    }

    if (artist.includes("$")) {
        artist = artist.replace(/[$]/g, "S");
    }

    if (artist.includes(".")) {
        artist = artist.replace(/[.]/g, "");
    }

    if (artist.includes("&")) {
        artist = artist.replace(/(&).*/g, "");
    }

    if (song.includes(" ")) {
        song = song.replace(/ /g, "");
    }

    if (song.includes(".")) {
        song = song.replace(/[.]/g, "");
    }

    if (song.includes("(")) {
        song = song.replace(/(\().*(\))/g, "");
    }

    if (song.includes(",")) {
        song = song.replace(/[,]/g, "");
    }

    if (song.includes("'")) {
        song = song.replace(/[']/g, "");
    }

    // individual case
    if (song.includes("-lpmix")) {
        song = song.replace(/(-lpmix)/g, "");
    }

    artist = artist.toLowerCase();
    song = song.toLowerCase();

    var params = {
        "song": song,
        "artist": artist
    };

    return params;
}

async function fetchLyrics(artist, song) {
    var params = formatAZLyricsParams(artist, song);

    var lyrics = "";
    try {
        var htmlObj = await getAZLyrics(params.artist, params.song);
        var lyrics = $(htmlObj).find(".ringtone ~ div").html();
        lyrics = lyrics.replace(/(?=<).*(?=>)./g, "");
    } catch (e) {
        error("fetch_lyrics");
    }

    return lyrics;
}

async function fetchAllLyrics(tracks) {
    var lyricsArr = [];

    // var proxy = "localhost:8888";
    // try {
    //     proxy = await getRandomProxy(4);
    // } catch {
    //     error("fetch_all_lyrics_1")
    // }   

    // console.log("proxy", proxy);
    var requestCounter = 0;

    for (var val of tracks[0]) {
        var artist = val.track.artists[0].name;
        var song = val.track.name;
        var uri = val.track.uri;
        // console.log("artist: " + artist);
        // console.log("song: " + song);

        // if (requestCounter % 10 == 0) {
        //     proxy = await getRandomProxy(4);
        // }

        // if (proxy == null) {
        //     error("fetch_all_lyrics_2");
        //     return null;
        // }

        var lyrics = await fetchLyrics(artist, song);

        if (lyrics != null) {
            var data = {
                lyrics: lyrics,
                uri: uri
            };

            lyricsArr.push(data);
        } else {
            error("fetch_all_lyrics_3");
            return null;
        }

        requestCounter++;

        if (requestCounter == 2) {
            break;
        }
    };

    // console.log(lyricsArr);

    return lyricsArr;
}

function filterPlaylist(lyrics) {
    var filtered = false;
    console.log(lyrics);
    $.each(lyrics, function (index, val1) {
        if (val1 == null) {
            console.log("skipped");
            return true;
        }

        $.each(tags, function (index, val2) {
            // console.log("val1: " + JSON.stringify(val1) + "val2: " + val2);

            console.log("val1 ^^^^^", val1);
            console.log("val2 ^^^^^", val2)
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
        var filteredPlaylist = lyrics;
        return filteredPlaylist;
    } else {
        console.log("false")
        return false;
    }
}

function postSpotify(url, data) {
    return new Promise((resolve, reject) => {
        $.ajax(url, {
            method: "POST",
            data: data,
            headers: {
                "Authorization": "Bearer " + access_token,
                "Content-Type": "application/json"
            },
            success: function (r) {
                resolve(r);
            },
            error: function (r) {
                error("send_to_spotify");
                reject("send_to_spotify");
            }
        });
    });
}

async function createPlaylist(name) {
    var url = "https://api.spotify.com/v1/users/" + uid + "/playlists";
    var data = JSON.stringify({
        "name": name,
        "public": "false"
    });

    try {
        playlist = await postSpotify(url, data);
        return playlist;
    } catch (e) {
        // console.log(e);
        error("create_playlist");
        return null;
    }
}

function addTracksToPlaylist(filteredPlaylist, playlistId) {
    var url = "https://api.spotify.com/v1/users/" + uid + "/playlists/" + playlistId + "/tracks"

    var uriArr = [];
    $.each(filteredPlaylist, function (index, val) {
        uriArr.push(val.uri);
    });

    var data = JSON.stringify({
        "uris": uriArr
    });

    postSpotify(url, data).catch(function (e) {
        error("create_playlist");
    });
}

async function startFiltering() {
    var tracks = await fetchTracks();

    if (tracks.length != 0) {
        var lyrics = await fetchAllLyrics(tracks);

        if (lyrics == null) {
            return;
        }

        var filteredPlaylist = filterPlaylist(lyrics);

        if (!filteredPlaylist) {
            $("#result-output").html("<br><span>Your playlist is already filtered! No keyword found.</span>");
        } else {
            var playlist = await createPlaylist(selectedPlaylistSpotify.name + " Filtered");

            if (playlist != null) {
                var playlistId = playlist.id;

                addTracksToPlaylist(filteredPlaylist, playlistId);

                $("#result-output").html("<br><span>Your playlist is filtered now! You find the songs in the new playlist of your Spotify account.");
            } else {
                error("create_playlist");
            }
        }
    }
}

// on event start
function createTag() {
    var tagInput = $("#tag-input").val();

    if (tagInput != null && !tags.includes(tagInput)) {
        if (tagCounter < 20) {
            if (tagCounter == 0) {
                $("#start-button").show();
            }

            $("#tags").append("<span id='" + tagInput + "' class='tag bg-dark'>" + tagInput + "<a><i id='" + tagInput + "' class='fa fa-times remove'></i></a></span>");
            tags.push(tagInput);
            tagCounter++;
            tagAmountCounter++;
        }
    }
}

function removeTag(id) {
    $("#tags").find("#" + id).remove();

    var index = tags.indexOf(id);
    tags.splice(index, 1);

    tagAmountCounter--;

    if (tagAmountCounter == 0) {
        $("#start-button").hide();
    }
}
// on event end

$(document).ready(function () {
    login();

    $(document).keyup(function (event) {
        if ($("#tag-input").is(":focus") && event.key == "Enter") {
            createTag();
        }
    });

    $("#tags").on("click", function (event) {
        // var id = event.target.id.match(/\d+/);
        var val = event.target.id;

        if (val != null) {
            // removeTag(id[0]);
            removeTag(val);
            tagCounter--;
        }
    });

    // hide playlist-form, show tag-form
    $("#playlists").on("click", function (event) {
        selectedPlaylistId = event.target.id.match(/\d+/);
        selectedPlaylistSpotify.name = event.target.getAttribute("spotify-name");
        selectedPlaylistSpotify.id = event.target.getAttribute("spotify-id");

        if (selectedPlaylistId) {
            navigationHandler(false, true);
        }
    });

    $("#add-button").on("click", function (event) { createTag(); });
    $("#start-button").on("click", function (event) { startFiltering(); });
});

/* TODO:
    better seperate functions (calls)
    remove unnecessary global vars

    lyrics cache
    anonymous proxy requests
    avoid google index
    little access statistic
*/