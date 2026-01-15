<script setup>
import { ref, defineProps, onMounted, onUnmounted, watch } from 'vue';
import spotifyApi from '../services/spotifyApi';
import spotifyPlayer from '../services/spotifyPlayer';

const props = defineProps({
  track: {
    type: Object,
    required: true,
  },
});

const isPlaying = ref(false);
const error = ref(null);
const isLoading = ref(false);
const currentPosition = ref(0);
const duration = ref(0);
const hoverTime = ref(0);
const showHoverTime = ref(false);
const hoverPosition = ref(0);
const isDragging = ref(false);
const previewPosition = ref(0);
const isHovering = ref(false);
let dragStartTime = 0;
let stateInterval = null;

const initializePlayer = async () => {
  try {
    isLoading.value = true;
    await spotifyPlayer.initialize();
  } catch (err) {
    error.value = `Failed to initialize player: ${err.message}`;
  } finally {
    isLoading.value = false;
  }
};

const playTrack = async () => {
  if (isLoading.value) return;
  
  isLoading.value = true;
  error.value = null;

  try {
    const deviceId = spotifyPlayer.getDeviceId();
    if (!deviceId) {
      throw new Error('Player not ready');
    }
    
    await spotifyApi.playTrack(props.track.uri, deviceId);
    isPlaying.value = true;
    
    // Wait a bit for playback to start, then start polling
    setTimeout(() => {
      startStatePolling();
    }, 500);
  } catch (err) {
    error.value = err.message;
  } finally {
    isLoading.value = false;
  }
};

const togglePlayPause = async () => {
  if (isLoading.value) return;
  
  error.value = null;

  try {
    const state = await spotifyPlayer.getCurrentState();
    
    // Check if we need to load a new track
    if (!state || state.track_window?.current_track?.uri !== props.track.uri) {
      // No state or different track, start playback of the selected track
      await playTrack();
      return;
    }
    
    isLoading.value = true;
    if (state.paused) {
      await spotifyPlayer.resume();
      isPlaying.value = true;
    } else {
      await spotifyPlayer.pause();
      isPlaying.value = false;
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
    const state = await spotifyPlayer.getCurrentState();
    if (state) {
      const newPosition = Math.max(0, state.position - 10000);
      await spotifyPlayer.seek(newPosition);
      currentPosition.value = newPosition;
    }
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
    const state = await spotifyPlayer.getCurrentState();
    if (state) {
      const newPosition = Math.min(state.duration, state.position + 10000);
      await spotifyPlayer.seek(newPosition);
      currentPosition.value = newPosition;
    }
  } catch (err) {
    error.value = err.message;
  } finally {
    isLoading.value = false;
  }
};

const startStatePolling = () => {
  stopStatePolling();
  stateInterval = setInterval(async () => {
    try {
      const state = await spotifyPlayer.getCurrentState();
      if (state) {
        isPlaying.value = !state.paused;
        currentPosition.value = state.position;
        duration.value = state.duration;
      }
    } catch (err) {
      // Silently fail - player might be disconnected
    }
  }, 1000);
};

const stopStatePolling = () => {
  if (stateInterval) {
    clearInterval(stateInterval);
    stateInterval = null;
  }
};

const formatTime = (ms) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const seekToPosition = (event) => {
  const progressBar = event.currentTarget;
  const clickPosition = event.offsetX;
  const barWidth = progressBar.offsetWidth;
  const percentage = clickPosition / barWidth;
  const newPosition = Math.floor(percentage * duration.value);
  
  spotifyPlayer.seek(newPosition);
  currentPosition.value = newPosition;
};

const handleProgressHover = (event) => {
  if (isDragging.value) return;
  
  const progressBar = event.currentTarget;
  const hoverX = event.offsetX;
  const barWidth = progressBar.offsetWidth;
  const percentage = hoverX / barWidth;
  
  hoverTime.value = Math.floor(percentage * duration.value);
  hoverPosition.value = percentage * 100;
  previewPosition.value = Math.floor(percentage * duration.value);
  showHoverTime.value = true;
  isHovering.value = true;
};

const handleProgressLeave = () => {
  if (!isDragging.value) {
    showHoverTime.value = false;
    isHovering.value = false;
  }
};

const handleProgressMouseDown = (event) => {
  event.preventDefault();
  isDragging.value = true;
  dragStartTime = Date.now();
  isHovering.value = false;
  
  const progressBar = event.currentTarget;
  const clickPosition = event.offsetX;
  const barWidth = progressBar.offsetWidth;
  const percentage = clickPosition / barWidth;
  const newPosition = Math.floor(percentage * duration.value);
  
  previewPosition.value = newPosition;
  hoverTime.value = newPosition;
  hoverPosition.value = percentage * 100;
  showHoverTime.value = true;
  
  document.addEventListener('mousemove', handleDragMove);
  document.addEventListener('mouseup', handleDragEnd);
};

const handleDragMove = (event) => {
  if (!isDragging.value) return;
  
  const progressBar = document.querySelector('.progress-bar-bg');
  if (!progressBar) return;
  
  const rect = progressBar.getBoundingClientRect();
  const offsetX = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
  const percentage = offsetX / rect.width;
  const newPosition = Math.floor(percentage * duration.value);
  
  previewPosition.value = newPosition;
  hoverTime.value = newPosition;
  hoverPosition.value = percentage * 100;
  showHoverTime.value = true;
};

const handleDragEnd = () => {
  if (isDragging.value) {
    const wasQuickClick = Date.now() - dragStartTime < 200;
    
    spotifyPlayer.seek(previewPosition.value);
    currentPosition.value = previewPosition.value;
    
    isDragging.value = false;
    showHoverTime.value = false;
    isHovering.value = false;
  }
  document.removeEventListener('mousemove', handleDragMove);
  document.removeEventListener('mouseup', handleDragEnd);
  document.removeEventListener('touchmove', handleTouchMove);
  document.removeEventListener('touchend', handleTouchEnd);
};

const handleProgressTouchStart = (event) => {
  event.preventDefault();
  isDragging.value = true;
  dragStartTime = Date.now();
  isHovering.value = false;
  
  const touch = event.touches[0];
  const progressBar = event.currentTarget;
  const rect = progressBar.getBoundingClientRect();
  const touchX = touch.clientX - rect.left;
  const barWidth = rect.width;
  const percentage = touchX / barWidth;
  const newPosition = Math.floor(percentage * duration.value);
  
  previewPosition.value = newPosition;
  hoverTime.value = newPosition;
  hoverPosition.value = percentage * 100;
  showHoverTime.value = true;
  
  document.addEventListener('touchmove', handleTouchMove, { passive: false });
  document.addEventListener('touchend', handleTouchEnd);
};

const handleTouchMove = (event) => {
  if (!isDragging.value) return;
  event.preventDefault();
  
  const progressBar = document.querySelector('.progress-bar-bg');
  if (!progressBar) return;
  
  const touch = event.touches[0];
  const rect = progressBar.getBoundingClientRect();
  const offsetX = Math.max(0, Math.min(touch.clientX - rect.left, rect.width));
  const percentage = offsetX / rect.width;
  const newPosition = Math.floor(percentage * duration.value);
  
  previewPosition.value = newPosition;
  hoverTime.value = newPosition;
  hoverPosition.value = percentage * 100;
  showHoverTime.value = true;
};

const handleTouchEnd = () => {
  handleDragEnd();
};

const handleKeyPress = (event) => {
  // Ignore if user is typing in an input field
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
    return;
  }
  
  switch (event.code) {
    case 'Space':
      event.preventDefault();
      togglePlayPause();
      break;
    case 'ArrowLeft':
      event.preventDefault();
      rewind10s();
      break;
    case 'ArrowRight':
      event.preventDefault();
      forward10s();
      break;
  }
};

// Watch for track changes
watch(() => props.track, async (newTrack, oldTrack) => {
  if (newTrack && oldTrack && newTrack.id !== oldTrack.id) {
    // Stop current playback and reset state
    stopStatePolling();
    
    // Try to pause using both the player and the API
    try {
      await spotifyPlayer.pause();
    } catch (err) {
      // Ignore errors if player not ready
    }
    
    try {
      await spotifyApi.pause();
    } catch (err) {
      // Ignore errors if nothing is playing
    }
    
    isPlaying.value = false;
    currentPosition.value = 0;
    duration.value = newTrack.duration_ms || 0;
    // Don't autoplay - user needs to press play button
  }
  
  // Set duration whenever track changes
  if (newTrack) {
    duration.value = newTrack.duration_ms || 0;
  }
}, { immediate: true });

onMounted(() => {
  initializePlayer();
  window.addEventListener('keydown', handleKeyPress);
});

onUnmounted(() => {
  stopStatePolling();
  window.removeEventListener('keydown', handleKeyPress);
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
        ⏪
      </button>
      <button @click="togglePlayPause" :disabled="isLoading" class="control-btn play-pause">
        {{ isPlaying ? '⏸️' : '▶️' }}
      </button>
      <button @click="forward10s" :disabled="isLoading" class="control-btn" title="Forward 10 seconds">
        ⏩
      </button>
    </div>

    <div class="progress-section">
      <div 
        class="progress-bar-container" 
        @mousedown="handleProgressMouseDown"
        @touchstart="handleProgressTouchStart"
        @mousemove="handleProgressHover"
        @mouseleave="handleProgressLeave"
      >
        <div class="progress-bar-bg">
          <div 
            class="progress-bar-fill" 
            :class="{ 'no-transition': isDragging }"
            :style="{ width: duration > 0 ? ((isDragging ? previewPosition : currentPosition) / duration * 100) + '%' : '0%' }"
          ></div>
          <div 
            v-if="isHovering && !isDragging && duration > 0 && previewPosition > currentPosition"
            class="progress-bar-preview"
            :style="{ 
              left: currentPosition / duration * 100 + '%',
              width: (previewPosition - currentPosition) / duration * 100 + '%'
            }"
          ></div>
          <div 
            class="progress-marker"
            :style="{ left: duration > 0 ? ((isDragging ? previewPosition : currentPosition) / duration * 100) + '%' : '0%' }"
          ></div>
        </div>
        <div 
          v-if="showHoverTime" 
          class="hover-time-tooltip"
          :style="{ left: hoverPosition + '%' }"
        >
          {{ formatTime(hoverTime) }}
        </div>
      </div>
      <div class="time-display">
        <span class="time-label">{{ formatTime(currentPosition) }}</span>
        <span class="time-label">{{ formatTime(duration) }}</span>
      </div>
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
  width: 120px;
  height: 120px;
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
  font-size: 1.3rem;
  color: #333;
  margin-bottom: 0.5rem;
}

.track-artists {
  font-size: 1rem;
  color: #666;
  margin-bottom: 0.5rem;
}

.track-album {
  font-size: 0.9rem;
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
  margin-bottom: 1rem;
}

.progress-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.time-display {
  display: flex;
  justify-content: space-between;
}

.time-label {
  font-size: 0.85rem;
  color: #666;
}

.progress-bar-container {
  cursor: pointer;
  padding: 12px 0;
  position: relative;
  user-select: none;
}

.progress-bar-bg {
  width: 100%;
  height: 12px;
  background: #e0e0e0;
  border-radius: 6px;
  overflow: visible;
  transition: height 0.2s;
  position: relative;
}

.progress-bar-container:hover .progress-bar-bg {
  height: 14px;
}

.progress-bar-fill {
  height: 100%;
  background: #1db954;
  transition: width 0.1s linear;
  border-radius: 6px;
  position: relative;
  z-index: 1;
}

.progress-bar-fill.no-transition {
  transition: none;
}

.progress-bar-preview {
  position: absolute;
  top: 0;
  height: 100%;
  background: rgba(255, 255, 255, 0.4);
  pointer-events: none;
  z-index: 2;
  border-radius: 6px;
}

.progress-marker {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 16px;
  height: 16px;
  background: white;
  border: 2px solid #1db954;
  border-radius: 50%;
  cursor: grab;
  opacity: 0;
  transition: opacity 0.2s;
  z-index: 5;
}

.progress-bar-container:hover .progress-marker {
  opacity: 1;
}

.progress-marker:active {
  cursor: grabbing;
}
.hover-time-tooltip {
  position: absolute;
  bottom: 100%;
  transform: translateX(-50%);
  margin-bottom: 8px;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  border-radius: 4px;
  font-size: 0.85rem;
  white-space: nowrap;
  pointer-events: none;
  z-index: 10;
}

.control-btn {
  background: #667eea;
  color: white;
  border: none;
  padding: 20px 40px;
  border-radius: 8px;
  font-size: 1.4rem;
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
  padding: 16px 32px;
  font-size: 1.1rem;
}

.control-btn.play-pause:hover:not(:disabled) {
  background: #1ed760;
}

@media (max-width: 640px) {
  .player {
    padding: 1rem;
  }
  
  .track-display {
    /* align-items: center; */
    /* text-align: center; */
    margin-bottom: 3rem;
  }

  .album-art {
    width: 60px;
    height: 60px;
  }

  .track-title {
    font-size: 0.9rem;
  }

  .track-artists {
    font-size: 0.8rem;
  }

  .track-album {
    font-size: 0.75rem;
  }

  .control-btn {
    padding: 16px 28px;
    font-size: 1.2rem;
  }

  .control-btn.play-pause {
    padding: 14px 24px;
    font-size: 1rem;
  }
}
</style>
