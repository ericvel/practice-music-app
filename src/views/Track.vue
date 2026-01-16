<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import spotifyApi from '../services/spotifyApi';
import spotifyPlayer from '../services/spotifyPlayer';
import Player from '../components/Player.vue';
import SearchBar from '../components/SearchBar.vue';

const route = useRoute();
const router = useRouter();
const track = ref(null);
const isLoading = ref(false);
const error = ref(null);

const loadTrack = async (trackId) => {
  if (!trackId) return;
  
  // Stop any current playback immediately
  try {
    await spotifyPlayer.pause();
  } catch (err) {
    // Ignore errors
  }
  try {
    const deviceId = spotifyPlayer.getDeviceId();
    if (deviceId) {
      await spotifyApi.pause(deviceId);
    }
  } catch (err) {
    // Ignore errors
  }
  
  isLoading.value = true;
  error.value = null;
  
  // Clear the current track to show loading state
  track.value = null;
  
  try {
    const trackData = await spotifyApi.getTrack(trackId);
    track.value = trackData;
  } catch (err) {
    error.value = err.message;
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  loadTrack(route.params.trackId);
});

// Watch for route changes to load new track
watch(() => route.params.trackId, (newTrackId) => {
  if (newTrackId) {
    loadTrack(newTrackId);
  }
});

const handleTrackSelect = (newTrack) => {
  router.push(`/tracks/${newTrack.id}`);
};
</script>

<template>
  <div class="track-view">
    <SearchBar @track-select="handleTrackSelect" />
    
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
    
    <Player v-if="track || isLoading" :track="track" :key="track?.id || 'loading'" />
  </div>
</template>

<style scoped>
.track-view {
  width: 100%;
  max-width: 800px;
}

.loading {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  text-align: center;
  margin-top: 1rem;
}

.error-message {
  background: #fee;
  color: #c33;
  padding: 1rem;
  border-radius: 12px;
  margin-top: 1rem;
}
</style>
