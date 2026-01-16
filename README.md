# ⏪︎ Rewindify

A Vue 3 + Vite single-page application for music practice using the Spotify Web API. Features OAuth 2.0 Authorization Code Flow with PKCE for secure authentication.

## Features

- 🔐 Secure Spotify OAuth login with PKCE
- 🔍 Search for tracks from Spotify's catalog
- 🎵 Play selected tracks with playback controls
- ⏪ Rewind 10 seconds
- ⏩ Forward 10 seconds
- ⏯️ Play/Pause controls
- 📱 Responsive design

## Prerequisites

- Node.js 16+ and npm
- A Spotify account (free or premium)
- A Spotify application registered at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)

## Setup Instructions

### 1. Create a Spotify Application

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in with your Spotify account
3. Click "Create app"
4. Fill in the app details:
   - **App name**: Rewindify (or any name you prefer)
   - **App description**: A practice app for musicians
   - **Redirect URI**: `http://localhost:5173/callback`
   - **API/SDKs**: Select "Web API"
5. Click "Save"
6. On the app page, click "Settings" to view your **Client ID**

### 2. Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Spotify credentials:
   ```
   VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id_here
   VITE_REDIRECT_URI=http://localhost:5173/callback
   ```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run the Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Usage

1. **Login**: Click "Login with Spotify" to authenticate with your Spotify account
2. **Search**: Use the search bar to find tracks
3. **Select**: Click on a track from the search results to select it
4. **Play**: The track will automatically start playing (requires an active Spotify device)
5. **Control**: Use the playback controls:
   - ⏪ **-10s**: Rewind 10 seconds
   - ⏯️ **Play/Pause**: Toggle playback
   - ⏩ **+10s**: Forward 10 seconds

## Important Notes

- **Active Device Required**: You need to have Spotify open on at least one device (desktop app, mobile app, or web player) for playback to work. The Spotify Web Playback SDK is not included in this barebones implementation.
- **Premium Account**: Some playback features may require a Spotify Premium account.
- **Token Expiry**: Access tokens expire after 1 hour. You'll need to log in again when the token expires.

## Build for Production

```bash
npm run build
```

The production-ready files will be in the `dist` directory.

To preview the production build:

```bash
npm run preview
```

## Technology Stack

- **Vue 3**: Progressive JavaScript framework
- **Vite**: Next-generation frontend tooling
- **Spotify Web API**: Music streaming and metadata
- **OAuth 2.0 with PKCE**: Secure authorization

## Project Structure

```
src/
├── components/
│   ├── Player.vue        # Playback controls and track display
│   ├── SearchBar.vue     # Search input and results container
│   └── TrackList.vue     # Display search results
├── services/
│   ├── spotifyAuth.js    # OAuth authentication logic
│   └── spotifyApi.js     # Spotify API requests
├── utils/
│   └── pkce.js          # PKCE helper functions
├── App.vue              # Main application component
└── main.js              # Application entry point
```

## License

MIT
