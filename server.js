const express = require("express");
const request = require("request");
const cors = require("cors");
const querystring = require("querystring");
const cookieParser = require("cookie-parser");
const util = require("util");
const axios = require("axios");
const tunnel = require("tunnel");
// const cheerio = require("cheerio");

const { spawn } = require("child_process");
const bat = spawn("cmd.exe", ["/c", "nordvpn-connect.bat"]);

// var proxy = require('proxy-list-random');

const spotifyData = require("./spotify-data");

const app = express();

const stateKey = "spotify_auth_state";
let uid;
let refresh_token;
let currentProxy;

let proxyRequestCounter = 0;

// var proxyOffset = 0;
// var proxies = [];

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

async function getData(url, proxyData = null) {
	let config;

	if (url == null) {
		console.log("url is null");
		return;
	}

	if (proxyData == null) {
		config = {
			method: "GET",
			url: url
		};	

		return axios(config);
	} else {		
		const proxyPort = proxyData.port == null ? 80 : proxyData.port;
		const agent = tunnel.httpsOverHttp({
			proxy: {
				host: proxyData.ip,
				port: proxyPort
			},
		});			

		const instance = axios.create({
			baseUrl: url,
			httpsAgent: agent
		});

		config = {
			method: "GET",
			url: url
			//proxy?
		};

		return instance(config);
	}

	// return axios(config);
}

async function getProxy() {
	// try {
	// 	let proxyUrl = "https://gimmeproxy.com/api/getProxy?get=true&supportsHttps=true&maxCheckPeriod=300&anonimityLevel=1";

	// 	const response = await getData(proxyUrl);
	// 	proxyRequestCounter++;

	// 	const proxyData = response.data;
	// 	console.log("newProxy");
	// 	console.log(proxyData);
	// 	currentProxy = proxyData;

	// 	return;
	// } catch (error) {
	// 	console.log("gimmeproxy suck dicks");
	// }

	try {
		// let proxyUrl = "https://www.proxy-list.download/api/v1/get";

		// const response = await getData(proxyUrl);		
		// proxyRequestCounter++;

		// const proxyData = response.data;
		// console.log("newProxy" + proxyData[0]);

		// if (currentProxy != proxyData[0]) {
		// 	currentProxy = proxyData[0];
		// } else {
		// 	if (proxyListCounter < proxyData.length) {
		// 		currentProxy = proxyData[proxyListCounter];
		// 		proxyListCounter++;
		// 	} else {
		// 		console.log("proxylist scraping exhausted");
		// 	}
		// }		

		bat.stdout.on("data", (data) => {
			console.log(data.toString());
		});

		try {
			let proxyUrl = "localhost:8010";

			const response = await getData(proxyUrl);
			proxyRequestCounter++;

			const proxyData = response.data;
			console.log("newProxy");
			console.log(proxyData);
			currentProxy = proxyData;

			return;
		} catch (error) {
			console.log("localhost sucks dicks");
		}

		return;
	} catch (error) {
		// console.log("proxylist sucks");
		console.log("batch script sucks");
	}

	
	// try {
	// 	let proxyUrl = "https://free-proxy-list.net/";

	// 	const response = await getData(proxyUrl);	
	// 	proxyRequestCounter++;

	// 	const html = response.data;
	// 	const $ = cheerio.load(html); 	

	// 	const proxy = $("tbody").find("td").first().text();
	// 	console.log("proxy scraped" + proxy);
	// 	currentProxy = proxy;

	// 	return;
	// } catch (error) {
	// 	console.log("proxy scraped sucks");
	// }
}

app.get("/proxy/lyrics/*", async (req, res) => {
	const urlPart = req.url.substring(6, req.url.length);
	const url = "https://www.azlyrics.com" + urlPart;

	if (proxyRequestCounter == 0 || proxyRequestCounter % 50 == 0) {
		await getProxy();
		proxyRequestCounter++;
	}

	try {
		if (currentProxy != null) {
			const response = await getData(url, currentProxy);
			req.pipe(response.data).pipe(res);
		} else {
			console.log("currentproxy is null or whatever");
		}
	} catch (error) {
		let inGetProxyLoop = true;
		while (inGetProxyLoop) {
			try {
				if (currentProxy != null) {
					const response = await getData(url, currentProxy);
					req.pipe(response.data).pipe(res);
				} else {
					console.log("currentproxy is null or whatever");
				}
			} catch (error) {
				if (!error.isAxiosError) {
					break;
				}

				await getProxy();
				proxyRequestCounter++;
			}
		}
	}
});

app.get("/login", function (req, res) {
	var state = generateRandomString(16);
	res.cookie(stateKey, state);

	// your application requests authorization
	var scope = "playlist-read-private playlist-modify-public playlist-modify-private playlist-read-collaborative";
	res.redirect("https://accounts.spotify.com/authorize?" + querystring.stringify({
		response_type: "code",
		client_id: spotifyData.clientId,scope: scope,
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