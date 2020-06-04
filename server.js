// Example values of environment variables:
// PORT="8888" (not required, requires restart)
// SCOPE="user-read-currently-playing"
// REDIRECT_URI="http://localhost:8888/callback"
// FRONTEND_URI="http://localhost:3000"
// SPOTIFY_CLIENT_ID="26e418da6b2a371c487229da0c2f3e1e"
// SPOTIFY_CLIENT_SECRET="e209fa710a61b07e3e44ca688fe9e392"
// ORIGINS='["http://localhost:3000"]' (requires restart)

let express = require("express");
let request = require("request");
let cors = require("cors");
let querystring = require("querystring");
let cookieParser = require("cookie-parser");

let stateKey = "spotify_auth_state";

const allowedOrigins = JSON.parse(process.env.ORIGINS);

const corsOptions = {
  origin: function (origin, callback) {
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS: " + origin));
    }
  },
};

let app = express();

app.use(cors(corsOptions)).use(cookieParser());

app.get("/login", function (req, res) {
  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  res.redirect(
    "https://accounts.spotify.com/authorize?" +
      querystring.stringify({
        response_type: "code",
        client_id: process.env.SPOTIFY_CLIENT_ID,
        scope: process.env.SCOPE,
        redirect_uri: process.env.REDIRECT_URI,
        state: state,
      })
  );
});

app.get("/callback", function (req, res) {
  let code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect(
      "/#" +
        querystring.stringify({
          error: "state_mismatch",
        })
    );
    return;
  }

  res.clearCookie(stateKey);

  let authOptions = {
    url: "https://accounts.spotify.com/api/token",
    form: {
      code: code,
      redirect_uri: process.env.REDIRECT_URI,
      grant_type: "authorization_code",
    },
    headers: {
      Authorization:
        "Basic " +
        new Buffer(
          process.env.SPOTIFY_CLIENT_ID +
            ":" +
            process.env.SPOTIFY_CLIENT_SECRET
        ).toString("base64"),
    },
    json: true,
  };

  request.post(authOptions, function (error, response, body) {
    if (error || response.statusCode !== 200) {
      res.redirect(
        "/#" +
          querystring.stringify({
            error: "invalid_token",
          })
      );
      return;
    }

    var access_token = body.access_token;
    var expires_in = body.expires_in;
    var refresh_token = body.refresh_token;
    let uri = process.env.FRONTEND_URI;

    res.redirect(
      uri +
        "?" +
        querystring.stringify({
          access_token: access_token,
          expires_in: expires_in,
          refresh_token: refresh_token,
        })
    );
  });
});

app.get("/refresh_token", function (req, res) {
  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: "https://accounts.spotify.com/api/token",
    form: {
      grant_type: "refresh_token",
      refresh_token: refresh_token,
    },
    headers: {
      Authorization:
        "Basic " +
        new Buffer(
          process.env.SPOTIFY_CLIENT_ID +
            ":" +
            process.env.SPOTIFY_CLIENT_SECRET
        ).toString("base64"),
    },
    json: true,
  };

  request.post(authOptions, function (error, response, body) {
    if (error || response.statusCode !== 200) return;

    var access_token = body.access_token;
    res.send({
      access_token: access_token,
    });
  });
});

let port = process.env.PORT || 8888;
console.log(
  `Listening on port ${port}. Go /login to initiate authentication flow.`
);
app.listen(port);

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function (length) {
  var text = "";
  var possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};
