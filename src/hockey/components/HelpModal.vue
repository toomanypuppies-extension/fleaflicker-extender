<template>
  <va-modal
    v-model="open"
    title="Help"
    hide-default-actions
    close-button
    disable-attachment
    max-width="640px"
    :background-color="themeBaseColor"
  >
    <div class="helpBody" :style="{ color: themeAccentColor }">
      <h3>Sorting</h3>
      <ul>
        <li>Click a column header to sort by it. Click again to reverse it, and a third time to remove it.</li>
        <li>
          Shift-click another column to sort by it as well. With two sorts, the
          <va-icon class="material-icons" size="1em">expand_more</va-icon>
          is numbered to show which comes first.
        </li>
      </ul>

      <h3>Filters</h3>
      <ul>
        <li>Filters combine, a player has to match all of them.</li>
        <li>Game Days shows teams playing on every day you pick.</li>
        <li>Use Clear filters to start over.</li>
      </ul>

      <template v-if="inExtension">
        <h3>This panel</h3>
        <ul>
          <li>
            Open and close it with the
            <va-icon class="material-icons" size="1em">sports_hockey</va-icon>
            tab on its left edge, or press Esc to close it.
          </li>
        </ul>
      </template>

      <h3>How fresh is the data?</h3>
      <ul>
        <li>
          Players are saved in your browser so the page loads quickly. Stats are fetched again once a day and
          while NHL games are being played, and ownership changes are picked up from league activity every few
          minutes.
        </li>
        <li>Refresh checks fleaflicker for changes right away.</li>
      </ul>
    </div>
  </va-modal>
</template>

<script>
import { mapGetters } from "vuex";

export default {
  computed: {
    ...mapGetters([
      'themeBaseColor',
      'themeAccentColor'
    ]),
    inExtension() {
      return !process.env.STANDALONE;
    },
    open: {
      get() {
        return this.$store.state.openHelp
      },
      set(value) {
        this.$store.commit('setKeyValue', { key: 'openHelp', value })
      },
    },
  },
};
</script>

<style scoped>
.helpBody h3 {
  font-size: 1.1em;
  font-weight: 700;
  margin: 1em 0 0.5em;
}

.helpBody h3:first-child {
  margin-top: 0;
}

.helpBody ul {
  list-style: square;
  padding-left: 1.5em;
}

.helpBody li {
  margin-bottom: 0.4em;
  line-height: 1.4;
}
</style>
