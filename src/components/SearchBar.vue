<script setup>
import { ref, watch, onMounted } from "vue";
import { Loader2 } from "lucide-vue-next";
import spotifyApi from "../services/spotifyApi";
import TrackList from "./TrackList.vue";

const emit = defineEmits(["track-select"]);

const searchQuery = ref("");
const searchResults = ref([]);
const recentTracks = ref([]);
const isSearching = ref(false);
const isFocused = ref(false);
const error = ref(null);
const selectedIndex = ref(-1);
let debounceTimer = null;

const loadRecentlyPlayed = async () => {
  try {
    const response = await spotifyApi.getRecentlyPlayed(50);
    // Extract unique tracks from recently played
    const tracksMap = new Map();
    response.items.forEach((item) => {
      if (!tracksMap.has(item.track.id)) {
        tracksMap.set(item.track.id, item.track);
      }
    });
    recentTracks.value = Array.from(tracksMap.values());
  } catch (err) {
    console.error("Failed to load recently played tracks:", err);
  }
};

const handleSearch = async () => {
  if (!searchQuery.value.trim()) {
    searchResults.value = [];
    return;
  }

  isSearching.value = true;
  error.value = null;

  try {
    const response = await spotifyApi.searchTracks(searchQuery.value);
    searchResults.value = response.tracks.items;
  } catch (err) {
    error.value = err.message;
    searchResults.value = [];
  } finally {
    isSearching.value = false;
  }
};

// Debounced search on input
watch(searchQuery, (newValue) => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  if (!newValue.trim()) {
    searchResults.value = [];
    isSearching.value = false;
    selectedIndex.value = -1;
    return;
  }

  debounceTimer = setTimeout(() => {
    handleSearch();
  }, 300);
});

watch(searchResults, () => {
  selectedIndex.value = -1;
});

const handleFocus = () => {
  isFocused.value = true;
  // Load recently played tracks if not already loaded
  if (recentTracks.value.length === 0) {
    loadRecentlyPlayed();
  }
};

const handleBlur = () => {
  // Delay to allow click events on tracks to fire
  setTimeout(() => {
    isFocused.value = false;
  }, 200);
};

const handleTrackSelect = (track) => {
  emit("track-select", track);
  // Clear search results after selecting a track
  searchResults.value = [];
  searchQuery.value = "";
  isFocused.value = false;
  selectedIndex.value = -1;
};

const handleKeyDown = (event) => {
  const currentTracks =
    searchResults.value.length > 0 ? searchResults.value : recentTracks.value;
  const isDropdownOpen =
    searchResults.value.length > 0 ||
    isSearching.value ||
    (isFocused.value &&
      !searchQuery.value.trim() &&
      recentTracks.value.length > 0);

  // Only handle Escape or if dropdown is open with tracks
  if (!isDropdownOpen && event.key !== "Escape") {
    return;
  }

  if (!currentTracks.length && event.key !== "Escape") {
    return;
  }

  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();
      selectedIndex.value = Math.min(
        selectedIndex.value + 1,
        currentTracks.length - 1
      );
      break;
    case "ArrowUp":
      event.preventDefault();
      selectedIndex.value = Math.max(selectedIndex.value - 1, -1);
      break;
    case "Enter":
    case " ":
      event.preventDefault();
      if (
        selectedIndex.value >= 0 &&
        selectedIndex.value < currentTracks.length
      ) {
        handleTrackSelect(currentTracks[selectedIndex.value]);
      }
      break;
    case "Escape":
      event.preventDefault();
      isFocused.value = false;
      searchQuery.value = "";
      searchResults.value = [];
      selectedIndex.value = -1;
      break;
  }
};

onMounted(() => {
  loadRecentlyPlayed();
});
</script>

<template>
  <div class="search-bar">
    <div class="search-input-wrapper">
      <div class="search-input-container">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search for a track..."
          class="search-input"
          @focus="handleFocus"
          @blur="handleBlur"
          @keydown="handleKeyDown"
        />
      </div>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>
    </div>

    <!-- Dropdown positioned absolutely -->
    <transition name="dropdown">
      <div
        v-if="
          searchResults.length > 0 ||
          isSearching ||
          (isFocused && !searchQuery.trim() && recentTracks.length > 0)
        "
        class="search-dropdown"
      >
        <div v-if="isSearching" class="loading-container">
          <Loader2 class="spinning" />
          <span>Searching...</span>
        </div>

        <div v-else-if="searchResults.length > 0" class="recent-tracks">
          <TrackList
            :tracks="searchResults"
            :selectedIndex="selectedIndex"
            title="Search results"
            @select="handleTrackSelect"
          />
        </div>

        <div
          v-else-if="
            isFocused && !searchQuery.trim() && recentTracks.length > 0
          "
          class="recent-tracks"
        >
          <TrackList
            :tracks="recentTracks"
            :selectedIndex="selectedIndex"
            title="Recently played"
            @select="handleTrackSelect"
          />
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.search-bar {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04);
  margin-bottom: 2rem;
  position: relative;
}

.search-input-wrapper {
  position: relative;
}

.search-input-container {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  position: relative;
}

.search-input {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.3s;
  width: 100%;
}

.search-input:focus-visible {
  outline: none;
  border-color: #667eea;
}

.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2rem;
  color: #667eea;
  font-size: 0.95rem;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 640px) {
  .search-bar {
    padding: 1rem;
  }
}

.error-message {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #fee;
  color: #c33;
  border-radius: 8px;
  font-size: 0.9rem;
}

.search-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 0.5rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08);
  z-index: 1000;
  max-height: 500px;
  overflow-y: auto;
  overflow-x: hidden;
}

/* Dropdown transition effects */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.dropdown-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

.recent-tracks {
  padding: 1rem;
}
</style>
