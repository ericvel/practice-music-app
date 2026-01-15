<script setup>
import { ref, defineProps, onMounted } from 'vue';
import spotifyApi from '../services/spotifyApi';

const props = defineProps({
  track: {
    type: Object,
    required: true,
  },
});

const isPlaying = ref(false);
const error = ref(null);
const isLoading = ref(false);

const playTrack = async () => {
  if (isLoading.value) return;
  
  isLoading.value = true;
  error.value = null;

  try {
    await spotifyApi.playTrack(props.track.uri);
    isPlaying.value = true;
  } catch (err) {
    error.value = err.message;
    // If no active device, provide helpful error message
    if (err.message.includes('No active device')) {
      error.value = 'No active Spotify device found. Please open Spotify on your device first.';
    }
  } finally {
    isLoading.value = false;
  }
};

const togglePlayPause = async () => {
  if (isLoading.value) return;
  
  isLoading.value = true;
  error.value = null;

  try {
    if (isPlaying.value) {
      await spotifyApi.pause();
      isPlaying.value = false;
    } else {
      await spotifyApi.play();
      isPlaying.value = true;
    }
  } catch (err) {
    error.value = err.message;
  } finally {
    isLoading.value = false;
  }
};

const rewind10s = async () => {
  if (isLoading.value) return;
  
  isLoading.value = true;
  error.value = null;

  try {
    await spotifyApi.skipBackward(10000);
  } catch (err) {
    error.value = err.message;
  } finally {
    isLoading.value = false;
  }
};

const forward10s = async () => {
  if (isLoading.value) return;
  
  isLoading.value = true;
  error.value = null;

  try {
    await spotifyApi.skipForward(10000);
  } catch (err) {
    error.value = err.message;
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  playTrack();
});
</script>

<template>
  <div class="player">
    <div class="track-display">
      <img
        v-if="track.album.images.length > 0"
        :src="track.album.images[0].url"
        :alt="track.album.name"
        class="album-art"
      />
      <div class="track-details">
        <h2 class="track-title">{{ track.name }}</h2>
        <p class="track-artists">{{ track.artists.map(a => a.name).join(', ') }}</p>
        <p class="track-album">{{ track.album.name }}</p>
      </div>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <div class="controls">
      <button @click="rewind10s" :disabled="isLoading" class="control-btn" title="Rewind 10 seconds">
        ⏪ -10s
      </button>
      <button @click="togglePlayPause" :disabled="isLoading" class="control-btn play-pause">
        {{ isPlaying ? '⏸️ Pause' : '▶️ Play' }}
      </button>
      <button @click="forward10s" :disabled="isLoading" class="control-btn" title="Forward 10 seconds">
        +10s ⏩
      </button>
    </div>
  </div>
</template>

<style scoped>
.player {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.track-display {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.album-art {
  width: 200px;
  height: 200px;
  border-radius: 8px;
  object-fit: cover;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.track-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.track-title {
  font-size: 1.8rem;
  color: #333;
  margin-bottom: 0.5rem;
}

.track-artists {
  font-size: 1.2rem;
  color: #666;
  margin-bottom: 0.5rem;
}

.track-album {
  font-size: 1rem;
  color: #999;
}

.error-message {
  margin-bottom: 1rem;
  padding: 1rem;
  background: #fee;
  color: #c33;
  border-radius: 6px;
  font-size: 0.9rem;
}

.controls {
  display: flex;
  justify-content: center;
  gap: 1rem;
}

.control-btn {
  background: #667eea;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.3s;
}

.control-btn:hover:not(:disabled) {
  background: #5568d3;
}

.control-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.control-btn.play-pause {
  background: #1db954;
  padding: 12px 32px;
}

.control-btn.play-pause:hover:not(:disabled) {
  background: #1ed760;
}

@media (max-width: 640px) {
  .track-display {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .album-art {
    width: 150px;
    height: 150px;
  }

  .track-title {
    font-size: 1.4rem;
  }

  .controls {
    flex-direction: column;
  }

  .control-btn {
    width: 100%;
  }
}
</style>
