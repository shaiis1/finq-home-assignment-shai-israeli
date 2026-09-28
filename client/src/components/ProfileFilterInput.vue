<script setup lang="ts">
// Single text input, wraps useDebouncedFilter. Filters by name or country, per PM Section 3.
const modelValue = defineModel<string>({ default: '' });

function onInput(event: Event): void {
  modelValue.value = (event.target as HTMLInputElement).value;
}
</script>

<template>
  <input
    class="profile-filter-input"
    type="text"
    :value="modelValue"
    placeholder="Filter by name or country..."
    aria-label="Filter by name or country"
    @input="onInput"
  />
</template>

<style scoped>
.profile-filter-input {
  width: 100%;
  max-width: 360px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-family: inherit;
  font-size: 0.95rem;
}

.profile-filter-input:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}
</style>
