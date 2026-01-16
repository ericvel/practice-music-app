<script setup>
import { ref, defineProps, onMounted, onUnmounted, watch, computed } from "vue";
import {
  Rewind,
  Play,
  Pause,
  FastForward,
  Settings,
  Trash2,
  Save,
} from "lucide-vue-next";
import spotifyApi from "../services/spotifyApi";
import spotifyPlayer from "../services/spotifyPlayer";

const props = defineProps({
  track: {
    type: Object,
    required: false,
    default: null,
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
const loopEnabled = ref(false);
const loopStart = ref(0);
const loopEnd = ref(0);
const isDraggingLoopStart = ref(false);
const isDraggingLoopEnd = ref(false);
const skipInterval = ref(10);
const showSettings = ref(false);
const isRewindLoading = ref(false);
const isForwardLoading = ref(false);
const isTrackLoading = ref(false);
const playButtonRef = ref(null);
const savedSegments = ref([]);
const newSegmentName = ref("");
let dragStartTime = 0;
let stateInterval = null;
let seekHoldInterval = null;
let accumulatedSeekAmount = 0;
let isHoldingSeek = false;

// Computed property to determine if we should show skeleton
const shouldShowSkeleton = computed(() => {
  return !props.track || isTrackLoading.value;
});

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
      throw new Error("Player not ready");
    }

    await spotifyApi.playTrack(props.track.uri, deviceId);
    isPlaying.value = true;

    // Determine starting position
    let startPosition = currentPosition.value;

    // If loop is enabled, start from loop start
    if (loopEnabled.value && loopStart.value > 0) {
      startPosition = loopStart.value;
    }

    // If user has set a position or loop is enabled, seek to it
    if (startPosition > 0) {
      setTimeout(async () => {
        try {
          await spotifyPlayer.seek(startPosition);
          currentPosition.value = startPosition;
        } catch (err) {
          // Ignore seek errors
        }
        startStatePolling();
      }, 500);
    } else {
      // Wait a bit for playback to start, then start polling
      setTimeout(() => {
        startStatePolling();
      }, 500);
    }
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
  if (isRewindLoading.value) return;

  isRewindLoading.value = true;
  error.value = null;

  try {
    const state = await spotifyPlayer.getCurrentState();
    const position = state?.position ?? currentPosition.value;

    let newPosition = position - skipInterval.value * 1000;

    // If loop is enabled, constrain to loop boundaries
    if (loopEnabled.value && loopEnd.value > loopStart.value) {
      newPosition = Math.max(loopStart.value, newPosition);
    } else {
      newPosition = Math.max(0, newPosition);
    }

    // If no current state, start playback first
    if (!state || state.track_window?.current_track?.uri !== props.track.uri) {
      await playTrack();
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    await spotifyPlayer.seek(newPosition);
    currentPosition.value = newPosition;
  } catch (err) {
    error.value = err.message;
  } finally {
    isRewindLoading.value = false;
  }
};

const forward10s = async () => {
  if (isForwardLoading.value) return;

  isForwardLoading.value = true;
  error.value = null;

  try {
    const state = await spotifyPlayer.getCurrentState();
    const position = state?.position ?? currentPosition.value;

    let newPosition = position + skipInterval.value * 1000;

    // If loop is enabled, constrain to loop boundaries
    if (loopEnabled.value && loopEnd.value > loopStart.value) {
      newPosition = Math.min(loopEnd.value, newPosition);
    } else {
      newPosition = Math.min(duration.value, newPosition);
    }

    // If no current state, start playback first
    if (!state || state.track_window?.current_track?.uri !== props.track.uri) {
      await playTrack();
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    await spotifyPlayer.seek(newPosition);
    currentPosition.value = newPosition;
  } catch (err) {
    error.value = err.message;
  } finally {
    isForwardLoading.value = false;
  }
};

const startSeekHold = (direction) => {
  if (isHoldingSeek) return;

  isHoldingSeek = true;
  accumulatedSeekAmount = 0;

  // Add initial seek amount immediately for quick clicks
  accumulatedSeekAmount =
    (direction === "forward" ? 1 : -1) * skipInterval.value * 1000;

  // Then continue accumulating if button is held
  seekHoldInterval = setInterval(() => {
    accumulatedSeekAmount +=
      (direction === "forward" ? 1 : -1) * skipInterval.value * 1000;

    // Update UI preview
    const state = currentPosition.value;
    let newPosition = state + accumulatedSeekAmount;

    if (loopEnabled.value && loopEnd.value > loopStart.value) {
      newPosition = Math.max(
        loopStart.value,
        Math.min(loopEnd.value, newPosition)
      );
    } else {
      newPosition = Math.max(0, Math.min(duration.value, newPosition));
    }

    currentPosition.value = newPosition;
  }, 100);
};

const endSeekHold = async (direction) => {
  if (!isHoldingSeek) return;

  isHoldingSeek = false;
  if (seekHoldInterval) {
    clearInterval(seekHoldInterval);
    seekHoldInterval = null;
  }

  // Make seek request with accumulated amount
  if (direction === "forward") {
    isForwardLoading.value = true;
  } else {
    isRewindLoading.value = true;
  }

  error.value = null;

  try {
    const state = await spotifyPlayer.getCurrentState();
    const position = state?.position ?? currentPosition.value;

    let newPosition = position + accumulatedSeekAmount;

    // If loop is enabled, constrain to loop boundaries
    if (loopEnabled.value && loopEnd.value > loopStart.value) {
      newPosition = Math.max(
        loopStart.value,
        Math.min(loopEnd.value, newPosition)
      );
    } else {
      newPosition = Math.max(0, Math.min(duration.value, newPosition));
    }

    // If no current state, start playback first
    if (!state || state.track_window?.current_track?.uri !== props.track.uri) {
      await playTrack();
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    await spotifyPlayer.seek(newPosition);
    currentPosition.value = newPosition;
  } catch (err) {
    error.value = err.message;
  } finally {
    if (direction === "forward") {
      isForwardLoading.value = false;
    } else {
      isRewindLoading.value = false;
    }
    accumulatedSeekAmount = 0;
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

        // Check if we need to loop
        if (
          loopEnabled.value &&
          loopEnd.value > loopStart.value &&
          !state.paused
        ) {
          if (state.position >= loopEnd.value) {
            await spotifyPlayer.seek(loopStart.value);
            currentPosition.value = loopStart.value;
          }
        }
      }
    } catch (err) {
      // Silently fail - player might be disconnected
    }
  }, 100);
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
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const parseTime = (timeString) => {
  const parts = timeString.split(":");
  if (parts.length !== 2) return 0;
  const minutes = parseInt(parts[0], 10) || 0;
  const seconds = parseInt(parts[1], 10) || 0;
  return (minutes * 60 + seconds) * 1000;
};

const handleLoopStartInput = (event) => {
  const newTime = parseTime(event.target.value);
  if (newTime >= 0 && newTime < loopEnd.value - 5000) {
    loopStart.value = newTime;
  }
};

const handleLoopEndInput = (event) => {
  const newTime = parseTime(event.target.value);
  if (newTime > loopStart.value + 5000 && newTime <= duration.value) {
    loopEnd.value = newTime;
  }
};

const constrainToLoop = (position) => {
  if (!loopEnabled.value || loopEnd.value <= loopStart.value) {
    return position;
  }
  return Math.max(loopStart.value, Math.min(position, loopEnd.value));
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
  // Don't start progress drag if clicking on loop markers
  if (event.target.classList.contains("loop-marker-head")) {
    return;
  }

  event.preventDefault();
  isDragging.value = true;
  dragStartTime = Date.now();
  isHovering.value = false;

  const progressBar = event.currentTarget;
  const clickPosition = event.offsetX;
  const barWidth = progressBar.offsetWidth;
  const percentage = clickPosition / barWidth;
  let newPosition = Math.floor(percentage * duration.value);

  // Constrain to loop if enabled
  newPosition = constrainToLoop(newPosition);

  previewPosition.value = newPosition;
  hoverTime.value = newPosition;
  hoverPosition.value = percentage * 100;
  showHoverTime.value = true;

  document.addEventListener("mousemove", handleDragMove);
  document.addEventListener("mouseup", handleDragEnd);
};

const handleDragMove = (event) => {
  if (!isDragging.value) return;

  const progressBar = document.querySelector(".progress-bar-bg");
  if (!progressBar) return;

  const rect = progressBar.getBoundingClientRect();
  const offsetX = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
  const percentage = offsetX / rect.width;
  let newPosition = Math.floor(percentage * duration.value);

  // Constrain to loop if enabled
  newPosition = constrainToLoop(newPosition);

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
  document.removeEventListener("mousemove", handleDragMove);
  document.removeEventListener("mouseup", handleDragEnd);
  document.removeEventListener("touchmove", handleTouchMove);
  document.removeEventListener("touchend", handleTouchEnd);
};

const handleProgressTouchStart = (event) => {
  // Don't start progress drag if touching on loop markers
  if (event.target.classList.contains("loop-marker-head")) {
    return;
  }

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
  let newPosition = Math.floor(percentage * duration.value);

  // Constrain to loop if enabled
  newPosition = constrainToLoop(newPosition);

  previewPosition.value = newPosition;
  hoverTime.value = newPosition;
  hoverPosition.value = percentage * 100;
  showHoverTime.value = true;

  document.addEventListener("touchmove", handleTouchMove, { passive: false });
  document.addEventListener("touchend", handleTouchEnd);
};

const handleTouchMove = (event) => {
  if (!isDragging.value) return;
  event.preventDefault();

  const progressBar = document.querySelector(".progress-bar-bg");
  if (!progressBar) return;

  const touch = event.touches[0];
  const rect = progressBar.getBoundingClientRect();
  const offsetX = Math.max(0, Math.min(touch.clientX - rect.left, rect.width));
  const percentage = offsetX / rect.width;
  let newPosition = Math.floor(percentage * duration.value);

  // Constrain to loop if enabled
  newPosition = constrainToLoop(newPosition);

  previewPosition.value = newPosition;
  hoverTime.value = newPosition;
  hoverPosition.value = percentage * 100;
  showHoverTime.value = true;
};

const handleTouchEnd = () => {
  handleDragEnd();
};

const handleKeyPress = (event) => {
  // Close settings on Escape
  if (event.code === "Escape" && showSettings.value) {
    showSettings.value = false;
    return;
  }

  // Ignore if user is typing in an input field
  if (
    event.target.tagName === "INPUT" ||
    event.target.tagName === "TEXTAREA" ||
    event.target.tagName === "SELECT"
  ) {
    return;
  }

  switch (event.code) {
    case "Space":
      event.preventDefault();
      togglePlayPause();
      break;
    case "ArrowLeft":
      event.preventDefault();
      rewind10s();
      break;
    case "ArrowRight":
      event.preventDefault();
      forward10s();
      break;
    case "KeyL":
      event.preventDefault();
      toggleLoop();
      break;
    case "BracketLeft":
      event.preventDefault();
      setLoopStart();
      break;
    case "BracketRight":
      event.preventDefault();
      setLoopEnd();
      break;
    case "KeyS":
      event.preventDefault();
      document
        .querySelector(
          'input[type="search"], input[placeholder*="Search"], .search-input'
        )
        ?.focus();
      break;
  }
};

const toggleLoop = async () => {
  const wasEnabled = loopEnabled.value;
  loopEnabled.value = !loopEnabled.value;

  // When enabling loop, set start to current position
  if (loopEnabled.value && !wasEnabled) {
    loopStart.value = currentPosition.value;

    // If end is not set or is before start, set it to 15 seconds after start
    if (loopEnd.value === 0 || loopEnd.value <= loopStart.value) {
      loopEnd.value = Math.min(loopStart.value + 15000, duration.value);
    }

    // If song is playing, pause and move to loop start
    if (isPlaying.value) {
      try {
        await spotifyPlayer.pause();
        isPlaying.value = false;

        if (loopStart.value > 0) {
          await spotifyPlayer.seek(loopStart.value);
          currentPosition.value = loopStart.value;
        }
      } catch (err) {
        // Ignore errors
      }
    }
  }
};

const loadSavedSegments = () => {
  if (!props.track?.id) return;
  try {
    const key = `segments_${props.track.id}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      savedSegments.value = JSON.parse(saved);
    } else {
      savedSegments.value = [];
    }
  } catch (err) {
    console.error("Failed to load saved segments:", err);
    savedSegments.value = [];
  }
};

const saveSegment = () => {
  if (!props.track?.id || !newSegmentName.value.trim()) return;
  if (loopStart.value === loopEnd.value) {
    error.value = "Please set loop markers before saving";
    setTimeout(() => {
      error.value = null;
    }, 3000);
    return;
  }

  const segment = {
    id: Date.now(),
    name: newSegmentName.value.trim(),
    start: loopStart.value,
    end: loopEnd.value,
  };

  savedSegments.value.push(segment);

  try {
    const key = `segments_${props.track.id}`;
    localStorage.setItem(key, JSON.stringify(savedSegments.value));
    newSegmentName.value = "";
  } catch (err) {
    error.value = "Failed to save segment";
    savedSegments.value.pop();
  }
};

const loadSegment = async (segment) => {
  loopStart.value = segment.start;
  loopEnd.value = segment.end;
  loopEnabled.value = true;

  // Update position for UI
  currentPosition.value = segment.start;

  // Only seek if track is currently playing
  try {
    const state = await spotifyPlayer.getCurrentState();
    if (state && state.track_window?.current_track?.uri === props.track.uri) {
      await spotifyPlayer.seek(segment.start);
    }
  } catch (err) {
    console.error("Failed to load segment:", err);
  }
};

const deleteSegment = (segmentId) => {
  if (!props.track?.id) return;

  savedSegments.value = savedSegments.value.filter((s) => s.id !== segmentId);

  try {
    const key = `segments_${props.track.id}`;
    localStorage.setItem(key, JSON.stringify(savedSegments.value));
  } catch (err) {
    console.error("Failed to delete segment:", err);
  }
};

const setLoopStart = () => {
  loopStart.value = currentPosition.value;
  if (loopStart.value >= loopEnd.value) {
    loopEnd.value = Math.min(loopStart.value + 5000, duration.value);
  }
  if (!loopEnabled.value) {
    loopEnabled.value = true;
  }
};

const setLoopEnd = () => {
  loopEnd.value = currentPosition.value;
  if (loopEnd.value <= loopStart.value) {
    loopStart.value = Math.max(0, loopEnd.value - 5000);
  }
  if (!loopEnabled.value) {
    loopEnabled.value = true;
  }
};

const handleLoopStartDrag = (event) => {
  event.stopPropagation();
  event.preventDefault();
  isDraggingLoopStart.value = true;

  // Pause playback when starting to drag
  if (isPlaying.value) {
    spotifyPlayer.pause().catch(() => {});
    isPlaying.value = false;
  }

  const handleMove = (e) => {
    if (!isDraggingLoopStart.value) return;

    const progressBar = document.querySelector(".progress-bar-bg");
    if (!progressBar) return;

    const rect = progressBar.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const offsetX = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = offsetX / rect.width;
    const newPosition = Math.floor(percentage * duration.value);

    loopStart.value = Math.min(newPosition, loopEnd.value - 5000);
  };

  const handleEnd = () => {
    isDraggingLoopStart.value = false;
    document.removeEventListener("mousemove", handleMove);
    document.removeEventListener("mouseup", handleEnd);
    document.removeEventListener("touchmove", handleMove);
    document.removeEventListener("touchend", handleEnd);

    // Seek to loop start if it's beyond current position
    if (loopStart.value > currentPosition.value) {
      currentPosition.value = loopStart.value;
      spotifyPlayer.seek(loopStart.value).catch(() => {});
    }
  };

  document.addEventListener("mousemove", handleMove);
  document.addEventListener("mouseup", handleEnd);
  document.addEventListener("touchmove", handleMove);
  document.addEventListener("touchend", handleEnd);
};

const handleLoopEndDrag = (event) => {
  event.stopPropagation();
  event.preventDefault();
  isDraggingLoopEnd.value = true;

  // Pause playback when starting to drag
  if (isPlaying.value) {
    spotifyPlayer.pause().catch(() => {});
    isPlaying.value = false;
  }

  const handleMove = (e) => {
    if (!isDraggingLoopEnd.value) return;

    const progressBar = document.querySelector(".progress-bar-bg");
    if (!progressBar) return;

    const rect = progressBar.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const offsetX = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = offsetX / rect.width;
    const newPosition = Math.floor(percentage * duration.value);

    loopEnd.value = Math.max(newPosition, loopStart.value + 5000);
  };

  const handleEnd = () => {
    isDraggingLoopEnd.value = false;
    document.removeEventListener("mousemove", handleMove);
    document.removeEventListener("mouseup", handleEnd);
    document.removeEventListener("touchmove", handleMove);
    document.removeEventListener("touchend", handleEnd);

    // Seek to loop end if it's before current position
    if (loopEnd.value < currentPosition.value) {
      currentPosition.value = loopEnd.value;
      spotifyPlayer.seek(loopEnd.value).catch(() => {});
    }
  };

  document.addEventListener("mousemove", handleMove);
  document.addEventListener("mouseup", handleEnd);
  document.addEventListener("touchmove", handleMove);
  document.addEventListener("touchend", handleEnd);
};

const handleClickOutside = (event) => {
  if (
    showSettings.value &&
    !event.target.closest(".settings-panel") &&
    !event.target.closest(".settings-toggle")
  ) {
    showSettings.value = false;
  }
};

// Watch for track changes
watch(
  () => props.track,
  async (newTrack, oldTrack) => {
    // Immediately show loading state when track prop changes
    if (!newTrack || (newTrack && oldTrack && newTrack.id !== oldTrack.id)) {
      isTrackLoading.value = true;
    }

    if (newTrack && (!oldTrack || newTrack.id !== oldTrack.id)) {
      // Stop current playback and reset state
      stopStatePolling();

      // Try to pause using both the player and the API
      try {
        await spotifyPlayer.pause();
      } catch (err) {
        // Ignore errors if player not ready
      }

      try {
        const deviceId = spotifyPlayer.getDeviceId();
        if (deviceId) {
          await spotifyApi.pause(deviceId);
        }
      } catch (err) {
        // Ignore errors if nothing is playing
      }

      isPlaying.value = false;
      currentPosition.value = 0;
      duration.value = newTrack.duration_ms || 0;
      loopEnabled.value = false;
      loopStart.value = 0;
      loopEnd.value = 0;
      // Don't autoplay - user needs to press play button

      // Fallback to hide loading state after 500ms if image load event doesn't fire
      setTimeout(() => {
        isTrackLoading.value = false;
        // Focus the play button after track loads (without showing focus ring)
        if (playButtonRef.value) {
          playButtonRef.value.focus({ preventScroll: true });
          playButtonRef.value.blur();
        }
        // Load saved segments for this track
        loadSavedSegments();
      }, 500);
    }

    // Set duration whenever track changes
    if (newTrack) {
      duration.value = newTrack.duration_ms || 0;
    }
  },
  { immediate: true, flush: "sync" }
);

onMounted(() => {
  initializePlayer();
  window.addEventListener("keydown", handleKeyPress);
  document.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
  stopStatePolling();
  window.removeEventListener("keydown", handleKeyPress);
  document.removeEventListener("click", handleClickOutside);
  if (seekHoldInterval) {
    clearInterval(seekHoldInterval);
  }
});
</script>

<template>
  <div class="player">
    <button
      class="settings-toggle"
      @click="showSettings = !showSettings"
      title="Settings"
    >
      <Settings />
    </button>

    <Transition name="settings-slide">
      <div v-if="showSettings" class="settings-panel">
        <h3 class="settings-title">Settings</h3>
        <div class="settings-item">
          <label for="skip-interval" class="settings-label"
            >Skip Interval:</label
          >
          <select
            id="skip-interval"
            v-model.number="skipInterval"
            class="settings-select"
          >
            <option :value="5">5 sec</option>
            <option :value="10">10 sec</option>
            <option :value="15">15 sec</option>
            <option :value="20">20 sec</option>
            <option :value="30">30 sec</option>
          </select>
        </div>
      </div>
    </Transition>

    <div class="track-display">
      <div v-if="shouldShowSkeleton" class="track-skeleton">
        <div class="skeleton skeleton-album-art"></div>
        <div class="track-details">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-artists"></div>
          <div class="skeleton skeleton-album"></div>
        </div>
      </div>
      <template v-else>
        <img
          v-if="track.album.images.length > 0"
          :src="track.album.images[0].url"
          :alt="track.album.name"
          class="album-art"
          @load="() => (isTrackLoading = false)"
        />
        <div class="track-details">
          <h2 class="track-title">{{ track.name }}</h2>
          <p class="track-artists">
            {{ track.artists.map((a) => a.name).join(", ") }}
          </p>
          <p class="track-album">{{ track.album.name }}</p>
        </div>
      </template>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <div class="controls">
      <button
        @mousedown="startSeekHold('rewind')"
        @mouseup="endSeekHold('rewind')"
        @mouseleave="endSeekHold('rewind')"
        @touchstart.prevent="startSeekHold('rewind')"
        @touchend.prevent="endSeekHold('rewind')"
        class="control-btn"
        :title="`Rewind ${skipInterval} seconds`"
      >
        <Rewind />
      </button>
      <button
        @click="togglePlayPause"
        class="control-btn play-pause"
        ref="playButtonRef"
      >
        <Play v-if="!isPlaying" />
        <Pause v-else />
      </button>
      <button
        @mousedown="startSeekHold('forward')"
        @mouseup="endSeekHold('forward')"
        @mouseleave="endSeekHold('forward')"
        @touchstart.prevent="startSeekHold('forward')"
        @touchend.prevent="endSeekHold('forward')"
        class="control-btn"
        :title="`Forward ${skipInterval} seconds`"
      >
        <FastForward />
      </button>
    </div>

    <div class="progress-section" :class="{ 'loop-active': loopEnabled }">
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
            :style="{
              left:
                loopEnabled && duration > 0
                  ? (loopStart / duration) * 100 + '%'
                  : '0%',
              width:
                loopEnabled && duration > 0
                  ? (((isDragging ? previewPosition : currentPosition) -
                      loopStart) /
                      duration) *
                      100 +
                    '%'
                  : duration > 0
                  ? ((isDragging ? previewPosition : currentPosition) /
                      duration) *
                      100 +
                    '%'
                  : '0%',
            }"
          ></div>
          <div
            v-if="
              isHovering &&
              !isDragging &&
              duration > 0 &&
              previewPosition > currentPosition
            "
            class="progress-bar-preview"
            :style="{
              left: (currentPosition / duration) * 100 + '%',
              width:
                ((previewPosition - currentPosition) / duration) * 100 + '%',
            }"
          ></div>
          <div
            v-if="loopEnabled && duration > 0"
            class="loop-segment"
            :style="{
              left: (loopStart / duration) * 100 + '%',
              width: ((loopEnd - loopStart) / duration) * 100 + '%',
            }"
          ></div>
          <div
            v-if="loopEnabled && duration > 0"
            class="loop-marker-head loop-marker-start"
            :style="{ left: (loopStart / duration) * 100 + '%' }"
            @mousedown="handleLoopStartDrag"
            @touchstart="handleLoopStartDrag"
            title="Drag to adjust loop start"
          >
            <div class="loop-marker-line"></div>
          </div>
          <div
            v-if="loopEnabled && duration > 0"
            class="loop-marker-head loop-marker-end"
            :style="{ left: (loopEnd / duration) * 100 + '%' }"
            @mousedown="handleLoopEndDrag"
            @touchstart="handleLoopEndDrag"
            title="Drag to adjust loop end"
          >
            <div class="loop-marker-line"></div>
          </div>
          <div
            class="progress-marker"
            :style="{
              left:
                duration > 0
                  ? ((isDragging ? previewPosition : currentPosition) /
                      duration) *
                      100 +
                    '%'
                  : '0%',
            }"
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

    <div class="loop-section">
      <div class="loop-toggle-container">
        <div class="loop-toggle-label" @click="toggleLoop">
          <span class="loop-label-text">Loop Segment</span>
          <div class="toggle-switch">
            <input
              type="checkbox"
              :checked="loopEnabled"
              class="toggle-input"
              readonly
            />
            <span class="toggle-slider"></span>
          </div>
        </div>
      </div>

      <Transition name="loop-expand">
        <div v-if="loopEnabled" class="loop-controls">
          <input
            type="text"
            :value="formatTime(loopStart)"
            @change="handleLoopStartInput"
            @blur="handleLoopStartInput"
            :disabled="!loopEnabled"
            class="loop-time-input"
            placeholder="0:00"
            aria-label="Loop start time (MM:SS)"
          />
          <span class="loop-separator">–</span>
          <input
            type="text"
            :value="formatTime(loopEnd)"
            @change="handleLoopEndInput"
            @blur="handleLoopEndInput"
            :disabled="!loopEnabled"
            class="loop-time-input"
            placeholder="0:00"
            aria-label="Loop end time (MM:SS)"
          />
        </div>
      </Transition>
    </div>

    <Transition name="loop-expand">
      <div v-if="loopEnabled" class="saved-segments-section">
        <h4 class="saved-segments-title">Saved Segments</h4>

        <div class="save-segment-form">
          <input
            v-model="newSegmentName"
            type="text"
            placeholder="Segment name..."
            class="segment-name-input"
            @keydown.enter="saveSegment"
            maxlength="50"
          />
          <button
            @click="saveSegment"
            class="save-segment-btn"
            :disabled="!newSegmentName.trim()"
            title="Save current loop markers"
          >
            <Save :size="16" />
            Save
          </button>
        </div>

        <div v-if="savedSegments.length > 0" class="saved-segments-list">
          <div
            v-for="segment in savedSegments"
            :key="segment.id"
            class="saved-segment-item"
          >
            <button
              @click="loadSegment(segment)"
              class="segment-load-btn"
              :title="`Load ${segment.name}`"
            >
              <span class="segment-name">{{ segment.name }}</span>
              <span class="segment-time"
                >{{ formatTime(segment.start) }} –
                {{ formatTime(segment.end) }}</span
              >
            </button>
            <button
              @click="deleteSegment(segment.id)"
              class="segment-delete-btn"
              title="Delete segment"
            >
              <Trash2 :size="16" />
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
* {
  interpolate-size: allow-keywords;
}

.player {
  background: linear-gradient(to bottom, #ffffff, #fafafa);
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: all 0.3s ease;
  position: relative;
}

.settings-toggle {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: transparent;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 8px;
  border-radius: 6px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
}

.settings-toggle:hover {
  background: #f5f5f5;
  color: #333;
}

.settings-panel {
  position: absolute;
  top: 3.5rem;
  right: 1rem;
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 10;
  min-width: 200px;
}

.settings-title {
  margin: 0 0 1rem 0;
  font-size: 1rem;
  color: #333;
  font-weight: 600;
}

.settings-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.settings-label {
  font-size: 0.9rem;
  color: #666;
  font-weight: 500;
}

.settings-select {
  padding: 8px 12px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 0.9rem;
  background: white;
  color: #333;
  cursor: pointer;
  transition: border-color 0.3s;
}

.settings-select:hover {
  border-color: #667eea;
}

.settings-select:focus-visible {
  outline: none;
  border-color: #667eea;
}

.settings-slide-enter-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.settings-slide-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.settings-slide-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.settings-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.track-display {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.track-skeleton {
  display: flex;
  gap: 1.5rem;
  width: 100%;
}

.skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 8px;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.skeleton-album-art {
  width: 120px;
  height: 120px;
  flex-shrink: 0;
}

.skeleton-title {
  height: 28px;
  width: 60%;
  margin-bottom: 0.5rem;
}

.skeleton-artists {
  height: 20px;
  width: 45%;
  margin-bottom: 0.5rem;
}

.skeleton-album {
  height: 18px;
  width: 40%;
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
  gap: 1.5rem;
  margin-bottom: 1.5rem;
  align-items: center;
}

.loop-toggle-container {
  display: flex;
  justify-content: center;
  margin-bottom: 1rem;
}

.loop-toggle-label {
  display: flex;
  align-items: center;
  gap: 1rem;
  cursor: pointer;
  user-select: none;
}

.loop-label-text {
  font-size: 1rem;
  color: #333;
  font-weight: 500;
}

.toggle-switch {
  position: relative;
  width: 50px;
  height: 26px;
}

.toggle-input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: 0.3s;
  border-radius: 26px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

.toggle-input:checked + .toggle-slider {
  background-color: #6b7280;
}

.toggle-input:checked + .toggle-slider:before {
  transform: translateX(24px);
}

.toggle-switch:hover .toggle-slider {
  box-shadow: 0 0 1px #6b7280;
}

.loop-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.75rem;
  overflow: hidden;
}

.loop-separator {
  font-size: 1.2rem;
  color: #666;
  font-weight: 400;
  user-select: none;
}

.loop-expand-enter-active {
  transition: height 0.2s ease, opacity 0.15s ease 0.1s;
}

.loop-expand-leave-active {
  transition: opacity 0.15s ease, height 0.2s ease 0.1s;
}

.loop-expand-enter-from,
.loop-expand-leave-to {
  height: 0;
  opacity: 0;
}

.loop-expand-enter-to,
.loop-expand-leave-from {
  height: auto;
  opacity: 1;
}

.loop-time-input {
  width: 80px;
  padding: 6px 10px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 0.9rem;
  text-align: center;
  transition: border-color 0.3s;
}

.loop-time-input:focus-visible {
  outline: none;
  border-color: #6b7280;
}

.loop-time-input:disabled {
  background: #f5f5f5;
  color: #999;
  cursor: not-allowed;
}

.saved-segments-section {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid #e0e0e0;
}

.saved-segments-title {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 1rem;
  text-align: center;
  font-weight: 500;
}

.save-segment-form {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.segment-name-input {
  flex: 1;
  padding: 8px 12px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 0.9rem;
  transition: border-color 0.3s;
  width: 100%;
}

.segment-name-input:focus-visible {
  outline: none;
  border-color: #6b7280;
}

.save-segment-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 8px 16px;
  background: #6b7280;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.save-segment-btn:hover:not(:disabled) {
  background: #6b7280;
  filter: brightness(1.1);
}

.save-segment-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.saved-segments-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.saved-segment-item {
  display: flex;
  gap: 0.5rem;
}

.segment-load-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 10px 12px;
  background: #f8f8f8;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.segment-load-btn:hover {
  background: #e8edff;
  border-color: #667eea;
}

.segment-name {
  font-size: 0.9rem;
  font-weight: 500;
  color: #333;
  margin-bottom: 0.25rem;
}

.segment-time {
  font-size: 0.8rem;
  color: #666;
}

.segment-delete-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  background: #fee;
  border: 2px solid #fdd;
  border-radius: 6px;
  color: #c33;
  cursor: pointer;
  transition: all 0.2s;
}

.segment-delete-btn:hover {
  background: #fcc;
  border-color: #fbb;
}

.progress-section {
  display: flex;
  flex-direction: column;
  transition: translate ease-in-out 0.2s;
  translate: 0;
  margin-bottom: 1.5rem;

  &.loop-active {
    translate: 0 1rem;
  }
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
  padding: 14px 0;
  position: relative;
  user-select: none;
}

.progress-bar-bg {
  width: 100%;
  height: 24px;
  background: #e0e0e0;
  border-radius: 9999px;
  overflow: visible;
  position: relative;
}

.progress-bar-fill {
  height: 100%;
  background: #1db954;
  transition: width 0.1s linear;
  border-radius: 9999px;
  position: absolute;
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
  border-radius: 9999px;
}

.loop-segment {
  position: absolute;
  top: 0;
  height: 100%;
  background: rgba(29, 185, 84, 0.2);
  pointer-events: none;
  z-index: 2;
  border-radius: 9999px;
}

.loop-marker-head {
  position: absolute;
  top: -40px;
  transform: translateX(-50%);
  width: 28px;
  height: 28px;
  background: #6b7280;
  border: 3px solid white;
  border-radius: 50%;
  cursor: grab;
  z-index: 6;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: transform 0.1s;
}

.loop-marker-head:hover {
  transform: translateX(-50%) scale(1.1);
}

.loop-marker-head:active {
  cursor: grabbing;
}

.loop-marker-line {
  position: absolute;
  left: 50%;
  top: 80%;
  transform: translateX(-50%);
  width: 3px;
  height: 46px;
  background: #6b7280;
  pointer-events: none;
  border-radius: 9999px;
}

.loop-marker-start .loop-marker-line {
  background: #6b7280;
}

.loop-marker-end .loop-marker-line {
  background: #6b7280;
}

.progress-marker {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 28px;
  height: 28px;
  background: white;
  border: 4px solid #1db954;
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 24px 40px;
  border-radius: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.25),
    0 1px 2px rgba(102, 126, 234, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.control-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #7c92f5 0%, #8b5cb8 100%);
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.35),
    0 2px 4px rgba(102, 126, 234, 0.2);
  transform: scale(1.08);
}

.control-btn:active:not(:disabled) {
  transform: scale(1.02);
  box-shadow: 0 2px 4px rgba(102, 126, 234, 0.25);
}

.control-btn:disabled {
  background: #f0f0f0;
  cursor: not-allowed;
  opacity: 0.4;
}

.control-btn.play-pause {
  background: #1db954;
  color: white;
  width: 80px;
  height: 80px;
  padding: 0;
  flex: none;
  box-shadow: 0 4px 16px rgba(29, 185, 84, 0.35),
    0 2px 4px rgba(29, 185, 84, 0.2);
}

.control-btn.play-pause:hover:not(:disabled) {
  background: #1ed760;
  box-shadow: 0 6px 24px rgba(29, 185, 84, 0.45),
    0 3px 8px rgba(29, 185, 84, 0.25);
  transform: scale(1.08);
}

.control-btn.play-pause:active:not(:disabled) {
  transform: scale(1.02);
  box-shadow: 0 4px 16px rgba(29, 185, 84, 0.35);
}

@media (max-width: 640px) {
  .player {
    padding: 1rem;
  }

  .track-display {
    margin-bottom: 3rem;
  }

  .album-art {
    width: 60px;
    height: 60px;
  }

  .skeleton-album-art {
    width: 60px;
    height: 60px;
  }

  .skeleton-title {
    height: 18px;
    width: 70%;
  }

  .skeleton-artists {
    height: 16px;
    width: 50%;
  }

  .skeleton-album {
    height: 14px;
    width: 45%;
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

  .controls {
    gap: 1rem;
  }

  .control-btn {
    padding: 24px 40px;
  }

  .control-btn.play-pause {
    width: 56px;
    height: 56px;
  }
}
</style>
