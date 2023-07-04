const express = require("express");
const request = require("request");
const cors = require("cors");
const querystring = require("querystring");
const cookieParser = require("cookie-parser");
const util = require("util");
const axios = require("axios");

const spotifyData = require("./spotify-data");

const app = express();

const stateKey = "spotify_auth_state";
let uid;
let refresh_token;

let proxyRequestCounter = 0;

function generateRandomString(length) {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return text;
}

app
  .use(express.static(__dirname + "/web"))
  .use(cors())
  .use(cookieParser());

function sleep(duration) {
  const currentTime = new Date().getTime();

  while (currentTime + duration >= new Date().getTime()) {}
}

async function getData(url) {
  const res = await axios.get(url);
  return res;
}

app.get("/proxy/lyrics/*", async (req, res) => {
  const urlPart = req.url.substring(6, req.url.length);
  const url = `http://localhost:8010/proxy${urlPart}`;

  try {
    const response = await getData(url);
    req
      .pipe(response.data)
      .pipe(res)
      .on("error", (e) => {
        console.log(e);
      });
  } catch (error) {
    if (!error.isAxiosError) {
      console.log("axios error");
      console.log(error);
    }

    res.status(204).send({ error: "Lyrics scraping failed!" });
  }

  proxyRequestCounter++;
});

app.get("/login", (req, res) => {
  const state = generateRandomString(16);
  res.cookie(stateKey, state);

  const scope =
    "playlist-read-private playlist-modify-public playlist-modify-private playlist-read-collaborative";
  res.redirect(
    `https://accounts.spotify.com/authorize?${querystring.stringify({
      response_type: "code",
      client_id: spotifyData.clientId,
      scope,
      redirect_uri: spotifyData.redirectUri,
      state,
    })}`
  );
});

app.get("/callback", (req, res) => {
  const code = req.query.code || null;
  const state = req.query.state || null;
  const storedState = req.cookies ? req.cookies[stateKey] : null;
  const error = req.query.error;

  if (!error) {
    if (state === null || state !== storedState) {
      error("state_mismatch");
    } else {
      res.clearCookie(stateKey);
      const authOptions = {
        url: "https://accounts.spotify.com/api/token",
        form: {
          code,
          redirect_uri: spotifyData.redirectUri,
          grant_type: "authorization_code",
        },
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${spotifyData.clientId}:${spotifyData.clientSecret}`
          ).toString("base64")}`,
        },
        json: true,
      };

      request.post(authOptions, (error, response, body) => {
        if (!error && response.statusCode === 200) {
          const access_token = body.access_token;
          refresh_token = body.refresh_token;

          const options = {
            url: "https://api.spotify.com/v1/me",
            headers: { Authorization: `Bearer ${access_token}` },
            json: true,
          };

          request.get(options, (error, response, body) => {
            console.log(`body: ${util.inspect(body, false, null, true)}`);
            uid = body.id;
            console.log(body.id);

            if (uid == null) {
              error("uid_null");
              return;
            }

            res.redirect(
              `/#${querystring.stringify({
                access_token,
                refresh_token,
                uid,
              })}`
            );
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

app.get("/refresh_token", (req, res) => {
  const authOptions = {
    url: "https://accounts.spotify.com/api/token",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${spotifyData.clientId}:${spotifyData.clientSecret}`
      ).toString("base64")}`,
    },
    form: {
      grant_type: "refresh_token",
      refresh_token: refresh_token,
    },
    json: true,
  };

  request.post(authOptions, (error, response, body) => {
    if (!error && response.statusCode === 200) {
      console.log("request triggered");
      const access_token = body.access_token;

      res.redirect(
        `/#${querystring.stringify({
          access_token,
          refresh_token,
          uid,
        })}`
      );
    }
  });

  console.log("request after triggered");
});

console.log("Listening on 8888");
app.listen(8888);
