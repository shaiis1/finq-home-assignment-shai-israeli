<script setup lang="ts">
// Screen 1 — /random
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useProfilesStore } from '../stores/profiles';
import { useNavigationStore } from '../stores/navigation';
import { useDebouncedFilter, matchesFilter } from '../composables/useDebouncedFilter';
import AppHeader from '../components/AppHeader.vue';
import ProfileRow from '../components/ProfileRow.vue';
import ProfileFilterInput from '../components/ProfileFilterInput.vue';
import ErrorBanner from '../components/ErrorBanner.vue';

const router = useRouter();
const profilesStore = useProfilesStore();
const navigationStore = useNavigationStore();
const { filterText, debouncedFilterText, setFilterText } = useDebouncedFilter();

const filteredProfiles = computed(() =>
  profilesStore.randomBatchProfiles.filter((p) => matchesFilter(p, debouncedFilterText.value))
);

function fetchBatch(): void {
  profilesStore.fetchRandomBatch();
}

function openProfile(id: string): void {
  navigationStore.setOrigin('random');
  router.push({ name: 'profile', params: { id } });
}

onMounted(() => {
  // Only auto-fetch on a genuinely first visit (empty batch). Re-mounting this view via Back
  // navigation from Screen 3 must NOT silently replace the batch — the ephemeral random-fetch
  // list has no backend to restore from, so clobbering it here would wipe out exactly the row
  // the user just saved (breaks PM Flow A's "row stays, gets a badge" requirement). Getting a
  // genuinely new batch is what the explicit "Fetch again" button is for.
  if (profilesStore.randomBatchIds.length === 0) {
    fetchBatch();
  }
});
</script>

<template>
  <main class="random-list">
    <AppHeader />

    <header class="random-list__header">
      <h1>Random Profiles</h1>
      <div class="random-list__controls">
        <ProfileFilterInput :model-value="filterText" @update:model-value="setFilterText" />
        <button class="button" type="button" @click="fetchBatch">Fetch again</button>
      </div>
    </header>

    <ErrorBanner
      v-if="profilesStore.randomStatus === 'error'"
      :message="profilesStore.randomError ?? 'Failed to load random profiles'"
      retryable
      @retry="fetchBatch"
      @dismiss="fetchBatch"
    />

    <p v-if="profilesStore.randomStatus === 'loading'" class="loading">Loading...</p>

    <ul v-else-if="filteredProfiles.length" class="random-list__rows">
      <li v-for="profile in filteredProfiles" :key="profile.id">
        <ProfileRow :profile="profile" @click="openProfile(profile.id)" />
      </li>
    </ul>

    <p v-else-if="profilesStore.randomStatus === 'success'" class="loading">
      No profiles match your filter.
    </p>
  </main>
</template>

<style scoped>
.random-list {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.random-list__header {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.random-list__controls {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.random-list__rows {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
</style>
