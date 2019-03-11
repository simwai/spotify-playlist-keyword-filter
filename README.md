# Spotify Playlist Keyword Filter

Money, Bitch, Smoking etc. All these words are in most of the current songs. If you want to have a clean playlist with none of such words, start using Spotify Playlist Keyword Filter. Maybe you have an addiction or little respect for women then listening to selected music can be benefiting.

Currently, the app is still in work.

## Installation

This project runs on Node.js. On [its website](http://www.nodejs.org/download/) you can find instructions on how to install it. You can also follow [this gist](https://gist.github.com/isaacs/579814) for a quick and easy way to install Node.js and npm.

Once installed, clone the repository and install its dependencies running:

    $ npm install

### Using your own credentials

You will need to register your app and get your own credentials from the Spotify for Developers Dashboard.

To do so, go to [your Spotify for Developers Dashboard](https://beta.developer.spotify.com/dashboard) and create your application. For this app, I registered this Redirect URI:

* http://localhost:8888/callback

Create the "spotify-data.js" file in the root folder and fill in your data:

```JavaScript
var clientId = '1234567890abcdefghijkl1234567890';
var clientSecret = '1234567890abcdefghijkl1234567890';
var redirectUri = '1234567890abcdefghijkl1234567890';

exports.clientId = clientId;
exports.clientSecret = clientSecret;
exports.redirectUri = redirectUri;
```

#### Running the app
In order to run the app, open the web folder, and run its "app.js" file.

    $ npm run-script start-server

Then, open "http://localhost:8888" in a browser.