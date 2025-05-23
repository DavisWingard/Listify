import passport from "passport";
import express from "express";
import { Strategy as SpotifyStrategy } from "passport-spotify";
import dotenv from "dotenv";
import session from "express-session";

dotenv.config();

const app = express();

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

passport.serializeUser(function (user, cb) {
  process.nextTick(function () {
    return cb(null, user);
  });
});

passport.deserializeUser(function (user, cb) {
  process.nextTick(function () {
    return cb(null, user);
  });
});

passport.use(
  new SpotifyStrategy(
    {
      clientID: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      callbackURL: "https://listify-9nxj.onrender.com/auth/spotify/callback",
    },
    (accessToken, refreshToken, profile, done) => {
      const user = {
        spotifyId: profile.id,
        displayName: profile.displayName,
        accessToken: accessToken,
        refreshToken: refreshToken,
      };
      done(null, user);
    }
  )
);

app.use(passport.initialize());
app.use(passport.session());

app.get(
  "/auth/spotify",
  passport.authenticate("spotify", {
    scope: [
      "user-read-private",
      "user-read-email",
      "playlist-modify-public",
      "playlist-modify-private",
    ],
    showDialog: true,
  })
);

app.get(
  "/auth/spotify/callback",
  passport.authenticate("spotify", { failureRedirect: "/" }),
  (req, res) => {
    if (!req.user || !req.user.accessToken) {
      return res.redirect("http://localhost:5173?error=missing_token");
    }

    const accessToken = req.user.accessToken;
    console.log("Access Token Retrieved:", accessToken);
    res.redirect(`https://listify-theta.vercel.app?access_token=${accessToken}`);
  }
);

const PORT = process.env.PORT || 8888;
app.listen(PORT, () => {
  console.log(`Server open on port ${PORT}`);
});
