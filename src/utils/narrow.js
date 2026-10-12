import { ref } from 'vue';

// Phone sized windows, where the player table becomes a list and filters move into a sheet
const query = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(max-width: 640px)') : null;

export const isNarrow = ref(!!query?.matches);

query?.addEventListener?.('change', (event) => {
  isNarrow.value = event.matches;
});
