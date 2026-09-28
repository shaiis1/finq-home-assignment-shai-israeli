<script setup lang="ts">
// Persistent top nav for the two list screens — otherwise there's no way to move between Random
// Fetch and Saved History without going back through Home first.
</script>

<template>
  <header class="app-header">
    <RouterLink class="app-header__brand" to="/">Finq Profiles</RouterLink>
    <nav class="app-header__nav" aria-label="Primary">
      <RouterLink class="app-header__link" to="/random" active-class="app-header__link--active">
        Fetch
      </RouterLink>
      <RouterLink class="app-header__link" to="/saved" active-class="app-header__link--active">
        History
      </RouterLink>
    </nav>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding-bottom: var(--space-3);
  margin-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}

.app-header__brand {
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--color-text);
  text-decoration: none;
}

.app-header__nav {
  display: flex;
  gap: var(--space-2);
}

.app-header__link {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius);
  color: var(--color-text-muted);
  text-decoration: none;
  font-weight: 600;
  font-size: 0.9rem;
}

.app-header__link:hover {
  background: var(--color-surface);
  color: var(--color-text);
}

.app-header__link--active {
  background: var(--color-primary);
  color: #ffffff;
}
</style>
