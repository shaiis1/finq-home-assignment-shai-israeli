<script setup lang="ts">
// Screen 2 — /saved. Reuses Screen 1's row component and filter, per spec.
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useProfilesStore } from '../stores/profiles';
import { useNavigationStore } from '../stores/navigation';
import { useDebouncedFilter, matchesFilter } from '../composables/useDebouncedFilter';
import ProfileRow from '../components/ProfileRow.vue';
import ProfileFilterInput from '../components/ProfileFilterInput.vue';
import ErrorBanner from '../components/ErrorBanner.vue';

const router = useRouter();
const profilesStore = useProfilesStore();
const navigationStore = useNavigationStore();
const { filterText, debouncedFilterText, setFilterText } = useDebouncedFilter();

const filteredProfiles = computed(() =>
  profilesStore.savedProfiles.filter((p) => matchesFilter(p, debouncedFilterText.value))
);

function loadSaved(): void {
  profilesStore.fetchSaved();
}

function openProfile(id: string): void {
  navigationStore.setOrigin('saved');
  router.push({ name: 'profile', params: { id } });
}

onMounted(() => {
  loadSaved();
});
</script>

<template>
  <main class="saved-list">
    <header class="saved-list__header">
      <h1>Saved Profiles</h1>
      <ProfileFilterInput :model-value="filterText" @update:model-value="setFilterText" />
    </header>

    <ErrorBanner
      v-if="profilesStore.savedStatus === 'error'"
      :message="profilesStore.savedError ?? 'Failed to load saved profiles'"
      retryable
      @retry="loadSaved"
      @dismiss="loadSaved"
    />

    <p v-if="profilesStore.savedStatus === 'loading'" class="loading">Loading...</p>

    <ul v-else-if="filteredProfiles.length" class="saved-list__rows">
      <li v-for="profile in filteredProfiles" :key="profile.id">
        <ProfileRow :profile="profile" @click="openProfile(profile.id)" />
      </li>
    </ul>

    <p v-else-if="profilesStore.savedStatus === 'success'" class="loading">
      No saved profiles yet.
    </p>
  </main>
</template>

<style scoped>
.saved-list {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.saved-list__header {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.saved-list__rows {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
</style>
