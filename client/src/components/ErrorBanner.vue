<script setup lang="ts">
withDefaults(defineProps<{ message: string; retryable?: boolean }>(), {
  retryable: false,
});
const emit = defineEmits<{ retry: []; dismiss: [] }>();
</script>

<template>
  <div class="error-banner" role="alert">
    <span>{{ message }}</span>
    <div class="error-banner__actions">
      <button v-if="retryable" class="button" type="button" @click="emit('retry')">
        Retry
      </button>
      <button
        class="button"
        type="button"
        aria-label="Dismiss error"
        @click="emit('dismiss')"
      >
        &times;
      </button>
    </div>
  </div>
</template>

<style scoped>
.error-banner__actions {
  display: flex;
  gap: var(--space-2);
  flex-shrink: 0;
}
</style>
