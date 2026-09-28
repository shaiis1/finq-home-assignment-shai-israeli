// Local filter-text ref + 300ms debounce. View-local (not store state) per architecture.md
// Section 2 — used identically by RandomListView and SavedListView via ProfileFilterInput.
import { onUnmounted, ref } from 'vue';
import type { Profile } from '../types';

const DEBOUNCE_MS = 300;

export function useDebouncedFilter() {
  const filterText = ref('');
  const debouncedFilterText = ref('');
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  function setFilterText(value: string): void {
    filterText.value = value;
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      debouncedFilterText.value = value;
    }, DEBOUNCE_MS);
  }

  onUnmounted(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });

  return { filterText, debouncedFilterText, setFilterText };
}

/** Case-insensitive substring match against `title first last` OR country. */
export function matchesFilter(profile: Profile, filter: string): boolean {
  const needle = filter.trim().toLowerCase();
  if (!needle) return true;
  const fullName = `${profile.name.title} ${profile.name.first} ${profile.name.last}`.toLowerCase();
  const country = profile.location.country.toLowerCase();
  return fullName.includes(needle) || country.includes(needle);
}
