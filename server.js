const express = require("express");
const request = require("request");
const cors = require("cors");
const querystring = require("querystring");
const cookieParser = require("cookie-parser");
const util = require("util");
const axios = require("axios");
const tunnel = require("tunnel");
const exec = require('child_process').exec;
// const cheerio = require("cheerio");

const spotifyData = require("./spotify-data");

const app = express();

const stateKey = "spotify_auth_state";
let uid;
let refresh_token;

let proxyRequestCounter = 0;

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
function generateRandomString(length) {
	let text = "";
	let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

	for (var i = 0; i < length; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}

	return text;
}

// eslint-disable-next-line no-undef
app.use(express.static(__dirname + "/web"))
	.use(cors())
	.use(cookieParser());

function reconnectNordVPN() {
	exec('cmd.exe /c nordvpn.bat');
}

/**
 * @param  {number} duration in milliseconds
 */
function sleep(duration) {
	const currentTime = new Date().getTime();

	while (currentTime + duration >= new Date().getTime()) { }
}

/**
 * @param  {string} url
 */
async function getData(url) {
	const res = await axios.get(url);
	return res;
}

app.get("/proxy/lyrics/*", (req, res) => {
	if (proxyRequestCounter === 0 || proxyRequestCounter % 30 === 0) {
		reconnectNordVPN();
		sleep(20000);
	}

	const urlPart = req.url.substring(6, req.url.length);
	const url = "http://localhost:8010/proxy" + urlPart;

	getData(url).then(response => req.pipe(response.data).pipe(res).on("error", (e) => {
		console.log(e);
	})).catch(error => {
		if (!error.isAxiosError) {
			console.log("axios error");
			console.log(error);
		}

		res.status(204).send({ error: "Lyrics scraping failed!" });
	});
	proxyRequestCounter++;
});

app.get("/login", function (req, res) {
	var state = generateRandomString(16);
	res.cookie(stateKey, state);

	// your application requests authorization
	var scope = "playlist-read-private playlist-modify-public playlist-modify-private playlist-read-collaborative";
	res.redirect("https://accounts.spotify.com/authorize?" + querystring.stringify({
		response_type: "code",
		client_id: spotifyData.clientId, scope: scope,
		redirect_uri: spotifyData.redirectUri,
		state: state
	}));
});

app.get("/callback", function (req, res) {
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
					// eslint-disable-next-line no-undef
					"Authorization": "Basic " + (Buffer.from(spotifyData.clientId + ":" + spotifyData.clientSecret).toString("base64"))
				},
				json: true
			};

			request.post(authOptions, function (error, response, body) {
				if (!error && response.statusCode === 200) {
					var access_token = body.access_token;
					refresh_token = body.refresh_token;

					var options = {
						url: "https://api.spotify.com/v1/me",
						headers: { "Authorization": "Bearer " + access_token },
						json: true
					};

					// use the access token to access the Spotify Web API
					request.get(options, function (error, response, body) {
						console.log("body: " + util.inspect(body, false, null, true));
						uid = body.id;
						console.log(body.id);

						if (uid == null) {
							error("uid_null");
							return;
						}

						// we can also pass the token to the browser to make requests from there
						res.redirect("/#" + querystring.stringify({
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

app.get("/refresh_token", function (req, res) {
	var authOptions = {
		url: "https://accounts.spotify.com/api/token",
		// eslint-disable-next-line no-undef
		headers: { "Authorization": "Basic " + (Buffer.from(spotifyData.clientId + ":" + spotifyData.clientSecret).toString("base64")) },
		form: {
			grant_type: "refresh_token",
			refresh_token: refresh_token
		},
		json: true
	};

	request.post(authOptions, function (error, response, body) {
		if (!error && response.statusCode === 200) {
			console.log("request triggered");
			var access_token = body.access_token;

			res.redirect("/#" + querystring.stringify({
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