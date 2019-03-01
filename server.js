var express = require("express");
var request = require("request");
var cors = require("cors");
var querystring = require("querystring");
var cookieParser = require("cookie-parser");
var util = require("util")

var spotifyData = require("./spotify-data");

var app = express();

var stateKey = "spotify_auth_state";
var uid;
var refresh_token;

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
function generateRandomString(length) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};

function error(msg) {
    res.redirect("/#" +
        querystring.stringify({
            error: msg
        }));
}

app.use(express.static(__dirname + "/web"))
    .use(cors())
    .use(cookieParser());

app.get("/login", function(req, res) {

    var state = generateRandomString(16);
    res.cookie(stateKey, state);

    // your application requests authorization
    var scope = "user-read-private user-read-email";
    res.redirect("https://accounts.spotify.com/authorize?" +
        querystring.stringify({
            response_type: "code",
            client_id: spotifyData.clientId,
            scope: scope,
            redirect_uri: spotifyData.redirectUri,
            state: state
        }));
});

app.get("/callback", function(req, res) {

    // your application requests refresh and access tokens
    // after checking the state parameter

    var code = req.query.code || null;
    var state = req.query.state || null;
    var storedState = req.cookies ? req.cookies[stateKey] : null;
    var error = req.query.error;


    if (!error) {
        if (state === null || state !== storedState) {
            error("state_mismatch");
        } else {
            res.clearCookie(stateKey);
            var authOptions = {
                url: "https://accounts.spotify.com/api/token",
                form: {
                    code: code,
                    redirect_uri: spotifyData.redirectUri,
                    grant_type: "authorization_code"
                },
                headers: {
                    "Authorization": "Basic " + (Buffer.from(spotifyData.clientId + ":" + spotifyData.clientSecret).toString("base64"))
                },
                json: true
            };

            request.post(authOptions, function(error, response, body) {
                if (!error && response.statusCode === 200) {
                    var access_token = body.access_token;
                    refresh_token = body.refresh_token;

                    var options = {
                        url: "https://api.spotify.com/v1/me",
                        headers: { "Authorization": "Bearer " + access_token },
                        json: true
                    };

                    // use the access token to access the Spotify Web API
                    request.get(options, function(error, response, body) {
                        console.log("body: " + util.inspect(body, false, null, true));
                        uid = body.id;
                        console.log(body.id);

                        // we can also pass the token to the browser to make requests from there
                        res.redirect("/#" +
                            querystring.stringify({
                                access_token: access_token,
                                refresh_token: refresh_token,
                                uid: uid
                            }));
                    });
                } else {
                   error("invalid_token");
                }
            });
        }
    } else {
        error("authorization_error");
    }
});

app.get("/refresh_token", function(req, res) {
    var authOptions = {
        url: "https://accounts.spotify.com/api/token",
        headers: { "Authorization": "Basic " + (Buffer.from(spotifyData.clientId + ":" + spotifyData.clientSecret).toString("base64")) },
        form: {
            grant_type: "refresh_token",
            refresh_token: refresh_token
        },
        json: true
    };

    request.post(authOptions, function(error, response, body) {
        if (!error && response.statusCode === 200) {
            console.log("request triggered");
            var access_token = body.access_token;

            res.redirect("/#" +
                querystring.stringify({
                    access_token: access_token,
                    refresh_token: refresh_token,
                    uid: uid
                }));
        }
    });
    console.log("request after triggered");
});

console.log("Listening on 8888");
app.listen(8888);