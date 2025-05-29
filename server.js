const express = require("express");
const cors = require("cors");
const path = require("path");
const { stringify } = require("querystring");
const cookieParser = require("cookie-parser");
const { inspect } = require("util");
const needle = require("needle");
const { gotScraping } = require("got-scraping");

const { clientId, redirectUri, clientSecret } = require("./spotify-data.js");

const app = express();
app.use(express.static(path.join(__dirname, "src")))
app.use(cors());
app.use(cookieParser());

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

app.all("/proxy/*", async (req, res) => {
  const url = req.url.substring(7).replace("https", "http");

  try {
    const response = await gotScraping({
      method: req.method,
      url: url,
      followRedirect: true,
      maxRedirects: 20,
      responseType: "json",
      headerGeneratorOptions:{
       browsers: [
           {
               name: 'chrome',
               minVersion: 87,
               maxVersion: 89
           }
       ],
       devices: ['desktop'],
       locales: ['de-DE', 'en-US'],
       operatingSystems: ['windows', 'linux'],
      }
    });

    res.set("access-control-allow-origin", "*");
    res.set("access-control-allow-headers", "*");
    res.set("access-control-allow-methods", "*");

    res.status(response.statusCode).send(response.body);
  } catch (error) {
    console.log("Internal Server Error: Proxy Failed\n", error);
    res.status(500).send("Internal Server Error: Proxy Failed");
  }

  proxyRequestCounter++;
});

app.get("/login", (req, res) => {
  const state = generateRandomString(16);
  res.cookie(stateKey, state);

  const scope =
    "playlist-read-private playlist-modify-public playlist-modify-private playlist-read-collaborative";
  res.redirect(
    `https://accounts.spotify.com/authorize?${stringify({
      response_type: "code",
      client_id: clientId,
      scope,
      redirect_uri: redirectUri,
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
      res.status(400).send("Invalid state parameter");
    } else {
      res.clearCookie(stateKey);
      const authOptions = {
        url: "https://accounts.spotify.com/api/token",
        form: {
          code,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        },
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${clientId}:${clientSecret}`
          ).toString("base64")}`,
        },
        json: true,
      };

      needle.post(authOptions.url, authOptions.form, { headers: authOptions.headers }, (error, response, body) => {
        if (!error && response.statusCode === 200) {
          const access_token = body.access_token;
          refresh_token = body.refresh_token;

          const options = {
            url: "https://api.spotify.com/v1/me",
            headers: { Authorization: `Bearer ${access_token}` },
            json: true,
          };

          needle.get(options.url, { headers: options.headers }, (error, response, body) => {
            if (!error && response.statusCode === 200) {
              console.log(`body: ${inspect(body, false, null, true)}`);
              uid = body.id;
              console.log(body.id);

              if (uid == null) {
                res.status(400).send("Invalid user ID");
              } else {
                res.redirect(
                  `/#${stringify({
                    access_token,
                    refresh_token,
                    uid,
                  })}`
                );
              }
            } else {
              res.status(500).send("Internal Server Error: Failed to fetch user data");
              console.error("Failed to fetch user data\n", error);
            }
          });
        } else {
          res.status(400).send("Invalid token");
          console.error("Invalid token\n", error);
        }
      });
    }
  } else {
    res.status(400).send("Authorization error");
  }
});

app.get("/refresh_token", (req, res) => {
  const authOptions = {
    url: "https://accounts.spotify.com/api/token",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${clientId}:${clientSecret}`
      ).toString("base64")}`,
    },
    form: {
      grant_type: "refresh_token",
      refresh_token: refresh_token,
    },
    json: true,
  };

  needle.post(authOptions.url, authOptions.form, { headers: authOptions.headers }, (error, response, body) => {
    if (!error && response.statusCode === 200) {
      console.log("Request triggered");
      const access_token = body.access_token;

      res.redirect(
        `/#${stringify({
          access_token,
          refresh_token,
          uid,
        })}`
      );
    } else {
      res.status(500).send("Internal Server Error: Failed to refresh token");
      console.error("Failed to refresh token\n", error);
    }
  });
});

console.log("Listening on 8888");
app.listen(8888);
