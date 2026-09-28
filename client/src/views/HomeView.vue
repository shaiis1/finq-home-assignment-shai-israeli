<script setup lang="ts">
// Screen 0 — static, no data fetching, no loading/error states.
import { useRouter } from 'vue-router';

const router = useRouter();
</script>

<template>
  <main class="home">
    <h1>Finq Profiles</h1>
    <div class="home__actions">
      <button class="button button--primary" type="button" @click="router.push('/random')">
        Fetch
      </button>
      <button class="button" type="button" @click="router.push('/saved')">History</button>
    </div>
  </main>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  min-height: 100vh;
  padding: var(--space-4);
}

.home__actions {
  display: flex;
  gap: var(--space-3);
}
</style>
