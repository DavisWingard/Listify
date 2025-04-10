import passport from "passport";
import { Strategy as SpotifyStrategy } from "passport-spotify";
import dotenv from "dotenv";

dotenv.config();

const app = express();

passport.use(
  new SpotifyStrategy(
    {
      clientID: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      callbackURL: "http://localhost:8888/auth/spotify/callback",
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

app.get(
  "/auth/spotify",
  passport.authenticate("spotify", {
    scope: ["user-read-private", "user-read-email", "playlist-modify-public", "playlist-modify-private"],
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
    res.redirect(`http://localhost:5173?access_token=${accessToken}`);
  }
);

app.listen(8888, () => {
  console.log("Server open - http://localhost:8888");
});
