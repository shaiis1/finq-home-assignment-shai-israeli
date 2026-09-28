// The one shared Pinia store — single source of truth for "have I seen this person and is it
// saved", keyed by login.uuid. See docs/planning/architecture.md Section 2 and
// docs/planning/pm-breakdown.md Section 0/2/4 for the full rationale; this file implements both
// exactly, including the optimistic-mutate-then-rollback-on-failure extension.
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { Profile, ProfileName } from '../types';
import { fetchRandomUsers } from '../api/randomUserApi';
import {
  createProfile,
  deleteProfileOnServer,
  fetchProfiles,
  updateProfileNameOnServer,
} from '../api/profilesApi';

type FetchStatus = 'idle' | 'loading' | 'success' | 'error';

const SAVE_ERROR_MESSAGE = "Couldn't save — please try again";
const UPDATE_ERROR_MESSAGE = "Couldn't update — please try again";
const DELETE_ERROR_MESSAGE = "Couldn't delete — please try again";

export const useProfilesStore = defineStore('profiles', () => {
  // ---- State ----
  const profilesById = ref<Record<string, Profile>>({});
  const randomBatchIds = ref<string[]>([]);

  const randomStatus = ref<FetchStatus>('idle');
  const randomError = ref<string | null>(null);

  const savedStatus = ref<FetchStatus>('idle');
  const savedError = ref<string | null>(null);

  const actionError = ref<string | null>(null);
  // Guards Save/Update/Delete against overlapping requests for the same id — see QA finding M1
  // (docs/planning/qa-report-backend.md): without this, a Save-then-Update fired before the POST
  // resolves could PATCH a not-yet-created row, or a failed rollback could be clobbered by a
  // still-in-flight success handler.
  const pendingActionId = ref<string | null>(null);

  // ---- Getters ----
  // Deliberately derived, not stored — see architecture.md Section 2 ("no separate savedIds
  // array"): keeps Screen 2's list structurally impossible to desync from profilesById.
  const savedProfiles = computed(() =>
    Object.values(profilesById.value).filter((p) => p.savedInBackend)
  );
  const randomBatchProfiles = computed(() =>
    randomBatchIds.value.map((id) => profilesById.value[id]).filter((p): p is Profile => !!p)
  );
  function getProfileById(id: string): Profile | undefined {
    return profilesById.value[id];
  }

  function clearActionError(): void {
    actionError.value = null;
  }

  // ---- Actions ----

  async function fetchRandomBatch(): Promise<void> {
    randomStatus.value = 'loading';
    randomError.value = null;
    try {
      const fetched = await fetchRandomUsers();
      for (const profile of fetched) {
        const existing = profilesById.value[profile.id];
        // Upsert: keep existing savedInBackend/name if we've already seen this id (id-collision
        // edge case — see architecture.md Section 2), only add if genuinely new.
        if (!existing) {
          profilesById.value[profile.id] = profile;
        }
      }
      randomBatchIds.value = fetched.map((p) => p.id);
      randomStatus.value = 'success';
    } catch (err) {
      randomStatus.value = 'error';
      randomError.value = err instanceof Error ? err.message : 'Failed to fetch random users';
    }
  }

  async function fetchSaved(): Promise<void> {
    savedStatus.value = 'loading';
    savedError.value = null;
    try {
      const fetched = await fetchProfiles();
      for (const profile of fetched) {
        // Backend is the source of truth for saved rows — full overwrite.
        profilesById.value[profile.id] = profile;
      }
      savedStatus.value = 'success';
    } catch (err) {
      savedStatus.value = 'error';
      savedError.value = err instanceof Error ? err.message : 'Failed to fetch saved profiles';
    }
  }

  /** Implements PM Flow A. `name` is the *current form value* — see architecture.md Section 2. */
  async function saveProfile(id: string, name: ProfileName): Promise<void> {
    const current = profilesById.value[id];
    if (!current || pendingActionId.value === id) return;

    const snapshot: Profile = { ...current };

    pendingActionId.value = id;
    // Optimistic: apply immediately, before the network call resolves.
    profilesById.value[id] = { ...current, name, savedInBackend: true };
    actionError.value = null;

    try {
      const saved = await createProfile(profilesById.value[id]);
      profilesById.value[id] = saved;
    } catch {
      // Rollback.
      profilesById.value[id] = snapshot;
      actionError.value = SAVE_ERROR_MESSAGE;
    } finally {
      pendingActionId.value = null;
    }
  }

  /** Implements PM Flows B (unsaved, local-only) and C (saved, PATCH). */
  async function updateProfileName(id: string, name: ProfileName): Promise<void> {
    const current = profilesById.value[id];
    if (!current || pendingActionId.value === id) return;

    if (!current.savedInBackend) {
      // Flow B: no network call, mutate the shared collection only.
      profilesById.value[id] = { ...current, name };
      actionError.value = null;
      return;
    }

    // Flow C: optimistic PATCH.
    pendingActionId.value = id;
    const previousName = current.name;
    profilesById.value[id] = { ...current, name };
    actionError.value = null;

    try {
      const updated = await updateProfileNameOnServer(id, name);
      profilesById.value[id] = updated;
    } catch {
      profilesById.value[id] = { ...profilesById.value[id], name: previousName };
      actionError.value = UPDATE_ERROR_MESSAGE;
    } finally {
      pendingActionId.value = null;
    }
  }

  /** Implements PM Flow D. */
  async function deleteProfile(id: string): Promise<void> {
    const current = profilesById.value[id];
    if (!current || pendingActionId.value === id) return;

    const snapshot: Profile = { ...current };

    pendingActionId.value = id;
    // Optimistic: flip the flag, don't delete the dict entry — see architecture.md Section 2
    // rationale (id may still be present in a currently-displayed random batch).
    profilesById.value[id] = { ...current, savedInBackend: false };
    actionError.value = null;

    try {
      await deleteProfileOnServer(id);
    } catch {
      profilesById.value[id] = snapshot;
      actionError.value = DELETE_ERROR_MESSAGE;
    } finally {
      pendingActionId.value = null;
    }
  }

  return {
    profilesById,
    randomBatchIds,
    randomStatus,
    randomError,
    savedStatus,
    savedError,
    actionError,
    pendingActionId,
    savedProfiles,
    randomBatchProfiles,
    getProfileById,
    clearActionError,
    fetchRandomBatch,
    fetchSaved,
    saveProfile,
    updateProfileName,
    deleteProfile,
  };
});
