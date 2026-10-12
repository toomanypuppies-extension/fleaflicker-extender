<template>
  <p class="loadingIndicator" role="status">
    <span class="spinner" aria-hidden="true"></span>
    <span>{{ text }}</span>
  </p>
</template>

<script>
/**
 * A spinner with what's loading, like "Loading matchups…"
 */
export default {
  props: {
    text: { type: String, default: 'Loading…' },
  },
};
</script>

<style lang="scss" scoped>
.loadingIndicator {
  display: flex;
  align-items: center;
  gap: 0.6em;
  margin: 0;
  font-size: 0.9em;
}

.spinner {
  flex: none;
  width: 1.1em;
  height: 1.1em;
  border: 2px solid var(--teamSecondaryColor30Opacity);
  border-top-color: var(--teamSecondaryColor);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

// Still shown as loading, without the motion
@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
    border-color: var(--teamSecondaryColor);
  }
}
</style>
