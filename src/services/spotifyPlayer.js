import spotifyAuth from './spotifyAuth';

/**
 * Spotify Web Playback SDK Service
 * Manages the in-browser Spotify player
 */
class SpotifyPlayerService {
  constructor() {
    this.player = null;
    this.deviceId = null;
    this.isReady = false;
    this.readyPromise = null;
    this.readyResolve = null;
    this.readyReject = null;
    
    // Set up the SDK ready callback immediately
    window.onSpotifyWebPlaybackSDKReady = () => {
      if (this.readyResolve) {
        this.initializePlayer(this.readyResolve, this.readyReject);
      }
    };
  }

  /**
   * Initialize the Spotify Web Playback SDK
   */
  async initialize() {
    // If already initialized, return the existing promise
    if (this.readyPromise) {
      return this.readyPromise;
    }

    this.readyPromise = new Promise((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
      
      // Check if SDK is already loaded
      if (window.Spotify) {
        this.initializePlayer(resolve, reject);
      }
      // Otherwise wait for the callback (already set up in constructor)
    });

    return this.readyPromise;
  }

  /**
   * Initialize the player instance
   */
  initializePlayer(resolve, reject) {
    const token = spotifyAuth.getAccessToken();
    if (!token) {
      reject(new Error('No access token available'));
      return;
    }

    this.player = new window.Spotify.Player({
      name: 'Music Practice App',
      getOAuthToken: cb => { cb(token); },
      volume: 0.5
    });

    // Ready
    this.player.addListener('ready', ({ device_id }) => {
      this.deviceId = device_id;
      this.isReady = true;
      resolve(device_id);
    });

    // Not Ready
    this.player.addListener('not_ready', ({ device_id }) => {
      this.isReady = false;
    });

    // Initialization Error
    this.player.addListener('initialization_error', ({ message }) => {
      reject(new Error(message));
    });

    // Authentication Error
    this.player.addListener('authentication_error', ({ message }) => {
      reject(new Error(message));
    });

    // Account Error
    this.player.addListener('account_error', ({ message }) => {
      reject(new Error(message));
    });

    // Connect to the player
    this.player.connect();
  }

  /**
   * Get the device ID
   */
  getDeviceId() {
    return this.deviceId;
  }

  /**
   * Get current playback state
   */
  async getCurrentState() {
    if (!this.player) {
      throw new Error('Player not initialized');
    }
    return this.player.getCurrentState();
  }

  /**
   * Toggle play/pause
   */
  async togglePlay() {
    if (!this.player) {
      throw new Error('Player not initialized');
    }
    return this.player.togglePlay();
  }

  /**
   * Resume playback
   */
  async resume() {
    if (!this.player) {
      throw new Error('Player not initialized');
    }
    return this.player.resume();
  }

  /**
   * Pause playback
   */
  async pause() {
    if (!this.player) {
      throw new Error('Player not initialized');
    }
    return this.player.pause();
  }

  /**
   * Seek to position (in milliseconds)
   */
  async seek(positionMs) {
    if (!this.player) {
      throw new Error('Player not initialized');
    }
    return this.player.seek(positionMs);
  }

  /**
   * Disconnect the player
   */
  disconnect() {
    if (this.player) {
      this.player.disconnect();
      this.player = null;
      this.deviceId = null;
      this.isReady = false;
      this.readyPromise = null;
    }
  }
}

export default new SpotifyPlayerService();
