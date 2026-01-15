<script setup>
import { useRouter } from 'vue-router';
import SearchBar from '../components/SearchBar.vue';

const router = useRouter();

const handleTrackSelect = (track) => {
  router.push(`/tracks/${track.id}`);
};
</script>

<template>
  <div class="home">
    <SearchBar @track-select="handleTrackSelect" />
  </div>
</template>

<style scoped>
.home {
  width: 100%;
  max-width: 800px;
}
</style>
