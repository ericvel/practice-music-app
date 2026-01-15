import spotifyAuth from './spotifyAuth';

const API_BASE = 'https://api.spotify.com/v1';

/**
 * Spotify API Service for search and playback control
 */
class SpotifyApiService {
  /**
   * Make an authenticated request to Spotify API
   */
  async makeRequest(endpoint, options = {}) {
    const token = spotifyAuth.getAccessToken();
    if (!token) {
      throw new Error('No access token available');
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        spotifyAuth.logout();
        throw new Error('Session expired. Please login again.');
      }
      const error = await response.json();
      throw new Error(error.error?.message || 'API request failed');
    }

    // Some endpoints return 204 No Content
    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  /**
   * Search for tracks
   */
  async searchTracks(query, limit = 20) {
    const params = new URLSearchParams({
      q: query,
      type: 'track',
      limit: limit.toString(),
    });

    return this.makeRequest(`/search?${params.toString()}`);
  }

  /**
   * Get current playback state
   */
  async getPlaybackState() {
    try {
      return await this.makeRequest('/me/player');
    } catch (error) {
      // Return null if no active device
      if (error.message.includes('No active device')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Start/resume playback of a specific track
   */
  async playTrack(trackUri, deviceId = null) {
    const body = {
      uris: [trackUri],
    };

    const params = deviceId ? `?device_id=${deviceId}` : '';
    return this.makeRequest(`/me/player/play${params}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  /**
   * Pause playback
   */
  async pause() {
    return this.makeRequest('/me/player/pause', {
      method: 'PUT',
    });
  }

  /**
   * Resume playback
   */
  async play() {
    return this.makeRequest('/me/player/play', {
      method: 'PUT',
    });
  }

  /**
   * Seek to position in currently playing track
   */
  async seek(positionMs) {
    return this.makeRequest(`/me/player/seek?position_ms=${positionMs}`, {
      method: 'PUT',
    });
  }

  /**
   * Skip forward by milliseconds
   */
  async skipForward(ms = 10000) {
    const state = await this.getPlaybackState();
    if (state && state.item) {
      const newPosition = Math.min(
        state.progress_ms + ms,
        state.item.duration_ms
      );
      return this.seek(newPosition);
    }
  }

  /**
   * Skip backward by milliseconds
   */
  async skipBackward(ms = 10000) {
    const state = await this.getPlaybackState();
    if (state && state.item) {
      const newPosition = Math.max(0, state.progress_ms - ms);
      return this.seek(newPosition);
    }
  }
}

export default new SpotifyApiService();
