<script setup>
const props = defineProps({
  tracks: {
    type: Array,
    required: true,
  },
  selectedIndex: {
    type: Number,
    default: -1,
  },
  title: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['select']);

const handleSelect = (track) => {
  emit('select', track);
};

const formatDuration = (ms) => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};
</script>

<template>
  <div class="track-list">
    <h3 v-if="title">{{ title }}</h3>
    <div class="tracks">
      <div
        v-for="(track, index) in tracks"
        :key="track.id"
        @click="handleSelect(track)"
        class="track-item"
        :class="{ 'track-selected': index === selectedIndex }"
      >
        <img
          v-if="track.album.images.length > 0"
          :src="track.album.images[track.album.images.length - 1].url"
          :alt="track.album.name"
          class="track-image"
        />
        <div class="track-info">
          <div class="track-name">{{ track.name }}</div>
          <div class="track-artist">{{ track.artists.map(a => a.name).join(', ') }}</div>
        </div>
        <div class="track-duration">{{ formatDuration(track.duration_ms) }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.track-list {
  padding: 0.5rem;
}

h3 {
  color: #333;
  margin-bottom: 1rem;
  font-size: 1.1rem;
  padding: 0 0.5rem;
}

.track-item {
  display: flex;
  align-items: center;
  padding: 0.75rem;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: background 0.2s;
}

.track-item:last-child {
  border-bottom: none;
}

.track-item:hover {
  background: #f8f8f8;
}

.track-item.track-selected {
  background: #e8edff;
  border-left: 4px solid #667eea;
  padding-left: calc(0.75rem - 4px);
}

.track-image {
  width: 48px;
  height: 48px;
  border-radius: 6px;
  margin-right: 1rem;
  object-fit: cover;
}

.track-info {
  flex: 1;
  min-width: 0;
}

.track-name {
  font-weight: 600;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-artist {
  font-size: 0.9rem;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-duration {
  color: #999;
  font-size: 0.9rem;
  margin-left: 1rem;
}
</style>
