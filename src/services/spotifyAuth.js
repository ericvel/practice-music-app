import { generateCodeVerifier, generateCodeChallenge } from '../utils/pkce';

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI;
const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';

const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'streaming'
];

/**
 * Spotify Authentication Service using OAuth 2.0 with PKCE
 */
class SpotifyAuthService {
  constructor() {
    this.accessToken = localStorage.getItem('spotify_access_token');
    this.tokenExpiry = localStorage.getItem('spotify_token_expiry');
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    if (!this.accessToken || !this.tokenExpiry) {
      return false;
    }
    return Date.now() < parseInt(this.tokenExpiry);
  }

  /**
   * Get the current access token
   */
  getAccessToken() {
    return this.accessToken;
  }

  /**
   * Initiate the login flow
   */
  async login() {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Store code verifier for later use
    localStorage.setItem('code_verifier', codeVerifier);

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      scope: SCOPES.join(' '),
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
    });

    window.location.href = `${AUTH_ENDPOINT}?${params.toString()}`;
  }

  /**
   * Handle the callback after authorization
   */
  async handleCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error) {
      throw new Error(`Authorization error: ${error}`);
    }

    if (!code) {
      throw new Error('No authorization code found');
    }

    const codeVerifier = localStorage.getItem('code_verifier');
    if (!codeVerifier) {
      throw new Error('No code verifier found');
    }

    // Exchange code for access token
    const body = new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier,
    });

    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Token exchange failed: ${errorData.error_description || errorData.error}`);
    }

    const data = await response.json();

    // Store access token and expiry
    this.accessToken = data.access_token;
    const expiresIn = data.expires_in * 1000; // Convert to milliseconds
    this.tokenExpiry = Date.now() + expiresIn;

    localStorage.setItem('spotify_access_token', this.accessToken);
    localStorage.setItem('spotify_token_expiry', this.tokenExpiry.toString());
    localStorage.removeItem('code_verifier');

    return this.accessToken;
  }

  /**
   * Logout user
   */
  logout() {
    this.accessToken = null;
    this.tokenExpiry = null;
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_token_expiry');
    localStorage.removeItem('code_verifier');
  }
}

export default new SpotifyAuthService();
