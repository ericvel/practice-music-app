<script setup>
import { ref } from 'vue';
import spotifyApi from '../services/spotifyApi';
import TrackList from './TrackList.vue';

const emit = defineEmits(['track-select']);

const searchQuery = ref('');
const searchResults = ref([]);
const isSearching = ref(false);
const error = ref(null);

const handleSearch = async () => {
  if (!searchQuery.value.trim()) {
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

const handleKeyPress = (e) => {
  if (e.key === 'Enter') {
    handleSearch();
  }
};

const handleTrackSelect = (track) => {
  emit('track-select', track);
};
</script>

<template>
  <div class="search-bar">
    <div class="search-input-container">
      <input
        v-model="searchQuery"
        @keypress="handleKeyPress"
        type="text"
        placeholder="Search for a track..."
        class="search-input"
      />
      <button @click="handleSearch" :disabled="isSearching" class="search-btn">
        {{ isSearching ? 'Searching...' : 'Search' }}
      </button>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <TrackList
      v-if="searchResults.length > 0"
      :tracks="searchResults"
      @select="handleTrackSelect"
    />
  </div>
</template>

<style scoped>
.search-bar {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.search-input-container {
  display: flex;
  gap: 0.5rem;
}

.search-input {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.3s;
}

.search-input:focus {
  outline: none;
  border-color: #667eea;
}

.search-btn {
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

.search-btn:hover:not(:disabled) {
  background: #5568d3;
}

.search-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.error-message {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #fee;
  color: #c33;
  border-radius: 6px;
  font-size: 0.9rem;
}
</style>
