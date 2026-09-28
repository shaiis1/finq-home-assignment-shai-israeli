<script setup lang="ts">
// Screen 3 — /profile/:id. Status (saved/unsaved) is derived live from the shared Pinia
// collection, keyed by id only — see architecture.md Sections 2 & 4, and pm-breakdown.md
// Section 2 (Flows A-D) for the exact button-visibility / navigation behavior implemented here.
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useProfilesStore } from '../stores/profiles';
import { useNavigationStore } from '../stores/navigation';
import ErrorBanner from '../components/ErrorBanner.vue';

const props = defineProps<{ id: string }>();
const router = useRouter();
const profilesStore = useProfilesStore();
const navigationStore = useNavigationStore();

const loading = ref(true);
const notFound = ref(false);
// Only the name's first-name is editable, per architecture.md Section 7 (title/last are
// display-only, carried through unchanged on Save/Update).
const draftFirstName = ref('');

const profile = computed(() => profilesStore.getProfileById(props.id));
const birthYear = computed(() => (profile.value ? Number(profile.value.dob.slice(0, 4)) : null));

async function ensureLoaded(): Promise<void> {
  loading.value = true;
  notFound.value = false;

  let current = profilesStore.getProfileById(props.id);
  if (!current) {
    // Direct-refresh / deep-link fallback (architecture.md Section 4): this id might be a saved
    // profile that just isn't loaded into this fresh session yet.
    await profilesStore.fetchSaved();
    current = profilesStore.getProfileById(props.id);
  }

  if (current) {
    draftFirstName.value = current.name.first;
  } else {
    notFound.value = true;
  }
  loading.value = false;
}

function currentDraftName() {
  const current = profile.value;
  return {
    title: current?.name.title ?? '',
    first: draftFirstName.value,
    last: current?.name.last ?? '',
  };
}

function goBack(): void {
  const target = navigationStore.lastOrigin === 'saved' ? '/saved' : '/random';
  router.push(target);
}

async function handleSave(): Promise<void> {
  await profilesStore.saveProfile(props.id, currentDraftName());
}

async function handleUpdate(): Promise<void> {
  await profilesStore.updateProfileName(props.id, currentDraftName());
}

async function handleDelete(): Promise<void> {
  await profilesStore.deleteProfile(props.id);
  if (!profilesStore.actionError) {
    goBack();
  }
}

onMounted(() => {
  ensureLoaded();
});

watch(() => props.id, ensureLoaded);

onUnmounted(() => {
  profilesStore.clearActionError();
});
</script>

<template>
  <div class="profile-detail-page">
    <ErrorBanner
      v-if="profilesStore.actionError"
      :message="profilesStore.actionError"
      @dismiss="profilesStore.clearActionError()"
    />

    <p v-if="loading" class="loading">Loading...</p>

    <div v-else-if="notFound" class="not-found">
      <p>Profile not found.</p>
      <RouterLink to="/">Back to Home</RouterLink>
    </div>

    <div v-else-if="profile" class="profile-detail" dir="rtl">
      <div class="profile-detail__top">
        <img
          class="profile-detail__picture"
          :src="profile.picture.large"
          :alt="`${profile.name.first} ${profile.name.last}`"
        />
        <h1 class="ltr-field" dir="ltr">
          {{ profile.name.title }} {{ profile.name.first }} {{ profile.name.last }}
        </h1>
      </div>

      <dl class="profile-detail__fields">
        <dt>מגדר</dt>
        <dd>{{ profile.gender }}</dd>

        <dt>שם</dt>
        <dd>
          <input
            class="ltr-field"
            dir="ltr"
            type="text"
            v-model="draftFirstName"
            aria-label="First name"
          />
        </dd>

        <dt>גיל</dt>
        <dd>{{ profile.age }}</dd>

        <dt>שנת לידה</dt>
        <dd>{{ birthYear }}</dd>

        <dt>כתובת</dt>
        <dd>
          <span class="ltr-field" dir="ltr">{{ profile.location.streetNumber }}</span>
          {{ profile.location.streetName }}, {{ profile.location.city }}
        </dd>

        <dt>מדינה</dt>
        <dd>{{ profile.location.state }}</dd>

        <dt>אימייל</dt>
        <dd><span class="ltr-field" dir="ltr">{{ profile.email }}</span></dd>

        <dt>טלפון</dt>
        <dd><span class="ltr-field" dir="ltr">{{ profile.phone }}</span></dd>
      </dl>

      <div class="profile-detail__actions">
        <button
          v-if="!profile.savedInBackend"
          class="button button--primary"
          type="button"
          @click="handleSave"
        >
          Save
        </button>
        <button
          v-if="profile.savedInBackend"
          class="button button--danger"
          type="button"
          @click="handleDelete"
        >
          Delete
        </button>
        <button class="button" type="button" @click="handleUpdate">Update</button>
        <button class="button" type="button" @click="goBack">Back</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-detail-page {
  max-width: 640px;
  margin: 0 auto;
  padding: var(--space-4);
}

.profile-detail {
  direction: rtl;
  text-align: right;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.profile-detail__top {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.profile-detail__picture {
  width: 96px;
  height: 96px;
  border-radius: 50%;
}

.profile-detail__fields {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: var(--space-2) var(--space-3);
  margin: 0;
}

.profile-detail__fields dt {
  color: var(--color-text-muted);
  font-weight: 600;
}

.profile-detail__fields dd {
  margin: 0;
}

.profile-detail__fields input[type='text'] {
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-family: inherit;
  font-size: 1rem;
  width: 100%;
  max-width: 240px;
}

.profile-detail__actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

/* Applied to every LTR-content field: name input, email, phone, street number. */
.ltr-field {
  direction: ltr;
  text-align: left;
  unicode-bidi: isolate;
  display: inline-block;
}

.not-found {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
</style>
