<script setup lang="ts">
// Shared row: thumbnail, name, gender, country, phone, email, badge. Used identically by
// RandomListView and SavedListView — build once, per PM Section 1.
import type { Profile } from '../types';
import SavedBadge from './SavedBadge.vue';

defineProps<{ profile: Profile }>();
const emit = defineEmits<{ click: [] }>();
</script>

<template>
  <button class="profile-row" type="button" @click="emit('click')">
    <img
      class="profile-row__thumbnail"
      :src="profile.picture.thumbnail"
      :alt="`${profile.name.first} ${profile.name.last}`"
      loading="lazy"
    />
    <div class="profile-row__main">
      <div class="profile-row__name-line">
        <span class="profile-row__name">
          {{ profile.name.title }} {{ profile.name.first }} {{ profile.name.last }}
        </span>
        <SavedBadge v-if="profile.savedInBackend" />
      </div>
      <div class="profile-row__meta">
        <span>{{ profile.gender }}</span>
        <span>{{ profile.location.country }}</span>
        <span>{{ profile.phone }}</span>
        <span>{{ profile.email }}</span>
      </div>
    </div>
  </button>
</template>

<style scoped>
.profile-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-bg);
  text-align: left;
  font-family: inherit;
  cursor: pointer;
  transition: background-color 0.15s;
}

.profile-row:hover {
  background: var(--color-surface);
}

.profile-row__thumbnail {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  flex-shrink: 0;
}

.profile-row__main {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.profile-row__name-line {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.profile-row__name {
  font-weight: 600;
}

.profile-row__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  color: var(--color-text-muted);
  font-size: 0.875rem;
}
</style>
