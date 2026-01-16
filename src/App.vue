<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import spotifyAuth from "./services/spotifyAuth";
import spotifyPlayer from "./services/spotifyPlayer";
import { Rewind } from "lucide-vue-next";

const router = useRouter();
const isAuthenticated = ref(false);
const isLoading = ref(false);
const error = ref(null);

onMounted(async () => {
  // Check if we have an authorization code in the URL (Spotify callback)
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code");

  if (code) {
    isLoading.value = true;
    try {
      await spotifyAuth.handleCallback();
      isAuthenticated.value = true;
      // Clean up URL by removing the code parameter
      window.history.replaceState({}, "", "/");
    } catch (err) {
      error.value = err.message;
    } finally {
      isLoading.value = false;
    }
  } else {
    isAuthenticated.value = spotifyAuth.isAuthenticated();
  }
});

onUnmounted(() => {
  // Clean up player when app unmounts
  spotifyPlayer.disconnect();
});

const handleLogin = () => {
  spotifyAuth.login();
};

const handleLogout = () => {
  spotifyPlayer.disconnect();
  spotifyAuth.logout();
  isAuthenticated.value = false;
  router.push("/");
};
</script>

<template>
  <div id="app">
    <header>
      <router-link to="/">
        <h1><Rewind size="28" /> Rewindify</h1>
      </router-link>
      <div v-if="isAuthenticated" class="user-section">
        <button @click="handleLogout" class="logout-btn">Logout</button>
      </div>
    </header>

    <main>
      <div v-if="isLoading" class="loading">
        <p>Loading...</p>
      </div>

      <div v-else-if="error" class="error">
        <p>Error: {{ error }}</p>
        <button @click="error = null">Dismiss</button>
      </div>

      <div v-else-if="!isAuthenticated" class="login-container">
        <div class="login-card">
          <h2>Welcome to Rewindify</h2>
          <p>
            Connect your Spotify account to start practicing with your favorite
            tracks.
          </p>
          <button @click="handleLogin" class="login-btn">
            Login with Spotify
          </button>
        </div>
      </div>

      <div v-else class="app-container">
        <router-view />
      </div>
    </main>
  </div>
</template>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
    Ubuntu, Cantarell, sans-serif;
  background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
  min-height: 100vh;
}

#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

header {
  background: rgba(255, 255, 255, 0.7);
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #333;
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

a {
  text-decoration: none;
}
h1 {
  font-size: 1.5rem;
  color: #333;
  text-decoration: none;
  display: flex;
  column-gap: 0.5rem;
  align-items: center;
}

main {
  flex: 1;
  padding: 2rem;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.loading,
.error {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04);
}

.error p {
  color: #e74c3c;
  margin-bottom: 1rem;
}

.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.login-card {
  background: white;
  padding: 3rem;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04);
  text-align: center;
  max-width: 400px;
}

.login-card h2 {
  color: #333;
  margin-bottom: 1rem;
}

.login-card p {
  color: #666;
  margin-bottom: 2rem;
  line-height: 1.5;
}

.login-btn {
  background: #1db954;
  color: white;
  border: none;
  padding: 12px 32px;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 24px;
  cursor: pointer;
  transition: background 0.3s;
}

.login-btn:hover {
  background: #1ed760;
}

.logout-btn {
  background: rgba(0, 0, 0, 0.05);
  color: #333;
  border: 1px solid rgba(0, 0, 0, 0.1);
  padding: 8px 20px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.logout-btn:hover {
  background: rgba(0, 0, 0, 0.1);
  border-color: rgba(0, 0, 0, 0.15);
}

.app-container {
  width: 100%;
  max-width: 800px;
}

button {
  font-family: inherit;
}

@media (max-width: 640px) {
  header {
    padding: 1rem;
  }

  h1 {
    font-size: 1.2rem;
  }

  main {
    padding: 1rem;
  }

  .login-card {
    padding: 2rem 1.5rem;
    margin: 0 1rem;
  }
}
</style>
