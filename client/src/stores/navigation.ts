// Tiny, dedicated store: holds one piece of ephemeral UI state (row-click origin), separate from
// profiles.ts's shared profile collection. See architecture.md Section 4.
import { defineStore } from 'pinia';
import { ref } from 'vue';

export type Origin = 'random' | 'saved';

export const useNavigationStore = defineStore('navigation', () => {
  const lastOrigin = ref<Origin | null>(null);

  function setOrigin(origin: Origin): void {
    lastOrigin.value = origin;
  }

  return { lastOrigin, setOrigin };
});
