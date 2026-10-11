<template>
  <button v-if="players.has(item.playerId)" type="button" class="playerName" @click.stop="$emit('open', item.playerId)">
    {{ item.playerName }}
  </button>
  <span v-else class="playerName plain">{{ item.playerName || 'a player' }}</span>
  <span v-if="details" class="playerDetails"> ({{ details }})</span>
</template>

<script>
// A player in the League tab's timeline, which opens their details when they're in the player table
export default {
  props: {
    // An activity item with playerId, playerName, playerTeam, playerPosition and injury
    item: Object,
    players: Map,
  },
  emits: ['open'],
  computed: {
    details() {
      return [this.item.playerTeam, this.item.playerPosition, this.item.injury].filter(Boolean).join(', ');
    },
  },
};
</script>

<style lang="scss" scoped>
.playerName {
  font: inherit;
  font-weight: 600;
  color: inherit;
  background: none;
  border: none;
  padding: 0;

  &:not(.plain) {
    cursor: pointer;
    text-decoration: underline;
  }

  &:focus-visible {
    outline: 2px solid var(--teamSecondaryColor);
  }
}

.playerDetails {
  opacity: 0.75;
}
</style>
