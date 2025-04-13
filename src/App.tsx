import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { authenticate } from "@/authenticate";
import "./App.css";
import { useEffect, useState } from "react";

function App() {
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<any[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<any | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [buttonText, setButtonText] = useState("Generate Playlist");

  useEffect(() => {
    // access token handoff and storage
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get("access_token");

    if (accessToken) {
      localStorage.setItem("spotifyAccessToken", accessToken);
      console.log(
        "Access Token Stored in Local Storage:",
        localStorage.getItem("spotifyAccessToken")
      );
      window.history.replaceState({}, document.title, "/");
    } else {
      console.log("No access token found.");
    }
  }, []);

  useEffect(() => {
    // search api
    const accessToken = localStorage.getItem("spotifyAccessToken");

    const timeout = setTimeout(() => {
      // request can only be made every 100ms
      fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(
          query
        )}&type=track&limit=10`, // most of these 10 tracks will be irrelevant, but later can be displayed by the first 5 unique tracks
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )
        .then((res) => res.json())
        .then((data) => {
          const allTracks = data.tracks?.items;
          const uniqueTracks = allTracks.filter(
            (track: { name: string }, index: any, self: any[]) => {
              const firstIndex = self.findIndex(
                (i) => i.name.toLowerCase() === track.name.toLowerCase()
              );
              return index === firstIndex;
            }
          );
          setTracks(uniqueTracks.slice(0, 5));
        })
        .catch((err) => console.error("Could not complete search:", err));
    }, 100);

    return () => clearTimeout(timeout);
  }, [query]);

  const getSimilarTracksFromLastFm = async (
    // lastfm api recommendations
    trackName: string,
    artistName: string
  ) => {
    // if any recruiters are reading this line im really good at not exposing API keys :)
    const apiKey = import.meta.env.VITE_LASTFM_APIKEY;

    const response = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=track.getsimilar&artist=${encodeURIComponent(
        artistName
      )}&track=${encodeURIComponent(
        trackName
      )}&limit=100&api_key=${apiKey}&format=json`
    );

    const data = await response.json();

    return data.similartracks?.track || [];
  };

  const selectTrack = async (track: any) => {
    setSelectedTrack(track);
    const similarTracks = await getSimilarTracksFromLastFm(
      track.name,
      track.artists[0]?.name
    );

    // testing logs
    console.log(`Similar tracks for: ${track.name} — ${track.artists[0].name}`);
    similarTracks.forEach((t: any, i: number) => {
      console.log(`${i + 1}. ${t.name} — ${t.artist.name}`);
    });
  };

  // get spotify track URI from title and artists -> data from last.fm
  const getSpotifyTrackUri = async (
    title: string,
    artist: string,
    accessToken: string
  ) => {
    const query = encodeURIComponent(`${title} ${artist}`);
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    const data = await response.json();
    return data.tracks?.items?.[0]?.uri || null;
  };

  // create playlist and seed with recommended songs in same step
  const createPlaylist = async (similarTracks: any[]) => {
    const accessToken = localStorage.getItem("spotifyAccessToken");
    if (!accessToken) {
      return;
    }

    // delcare user to create playlist
    const userRes = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userData = await userRes.json();
    const userId = userData.id;

    const playlist = await fetch(
      `https://api.spotify.com/v1/users/${userId}/playlists`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `Listification for song: ${selectedTrack.name} - ${selectedTrack.artists[0]?.name}`,
          description: `Recommended songs based on "${selectedTrack.name}" - ${selectedTrack.artists[0].name}`,
          public: false,
        }),
      }
    );
    const playlistData = await playlist.json();
    const playlistId = playlistData.id;

    // convert similarTracks playlist to spotify URIs to seed into playlist
    const uris: string[] = [];
    for (const track of similarTracks) {
      if (uris.length >= 100) break; // ✅ Stop if you have 100 URIs
      const uri = await getSpotifyTrackUri(
        track.name,
        track.artist.name,
        accessToken
      );
      if (uri) uris.push(uri);
    }

    setTimeout(async () => {
      const addTracksToPlaylist = await fetch(
        `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uris: uris,
          }),
        }
      );

      if (addTracksToPlaylist.ok) {
        window.open(playlistData.external_urls.spotify, "_blank");
      } else {
        const error = await addTracksToPlaylist.json();
        console.error("Error adding tracks to playlist:", error);
      }
    }, 100);
    setIsGenerating(false);
  };

  return (
    <>
      <div className="flex justify-end p-5">
        <Button variant="outline" onClick={authenticate}>
          Sign in to Spotify
        </Button>
      </div>
      <div className="text-spotifygreen text-4xl">Welcome to Listify!</div>
      <div>
        <Textarea
          className="mb-4 text-white"
          placeholder="Search for a song."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div>
        <Button
          className="mb-4 bg-white text-black hover:bg-white hover:text-black text-xs sm:text-base"
          onClick={async () => {
            setIsGenerating(true);
            if (selectedTrack) {
              setIsGenerating(true);
              setButtonText(
                "Playlist is generating. You will be redirected automatically."
              );
              const similarTracks = await getSimilarTracksFromLastFm(
                selectedTrack.name,
                selectedTrack.artists[0].name
              );

              if (similarTracks.length === 0) {
                setButtonText(
                  "Hmm, we don't know that song. Try something else."
                );
                setIsGenerating(false);
                return;
              }

              createPlaylist(similarTracks);
              setIsGenerating(false);
            }
          }}
          disabled={!selectedTrack || isGenerating}
        >
          {buttonText}
        </Button>
      </div>
      <div>
        <ul className="text-white">
          {tracks.map((track) => (
            <li
              key={track.id}
              onClick={() => selectTrack(track)}
              className={`rounded cursor-pointer transition-all text-xl
              ${
                selectedTrack?.id === track.id
                  ? "border border-spotifygreen"
                  : "border border-transparent"
              } 
              hover:border-spotifygreen`}
            >
              <div className="flex items-center justify-start p-[0.5mm]">
                <img
                  className="mb-2 mr-2"
                  src={
                    track.album.images?.[0]?.url || track.album.images?.[0]?.url
                  }
                  alt={`Album art for ${track.name}`}
                  width={96}
                  height={96}
                />
                <span>
                  {track.name} —{" "}
                  {track.artists.map((a: any) => a.name).join(", ")}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export default App;
