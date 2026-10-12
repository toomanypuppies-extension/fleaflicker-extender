<template>
  <span class="helpTip">
    <button ref="button" type="button" class="helpButton" :aria-expanded="open" :aria-controls="panelId"
      :aria-label="`About ${label}`" :title="`About ${label}`" @click.stop="toggle">
      <span class="material-icons" aria-hidden="true">{{ open ? 'close' : 'help_outline' }}</span>
    </button>
    <span v-if="open" :id="panelId" class="helpPanel" role="note" :style="panelStyle" @click.stop><slot /></span>
  </span>
</template>

<script>
let nextId = 0;

/**
 * A "?" button that shows an explanation over its section, for text that's useful once but would
 * crowd the page if always shown. Closes on a click elsewhere or Esc. The nearest positioned
 * ancestor (the section) sets the panel's width.
 */
export default {
  props: {
    // What it explains, for the button's label: "About {label}"
    label: String,
  },
  data() {
    return {
      open: false,
      panelId: `helpTip${++nextId}`,
      panelStyle: {},
    };
  },
  methods: {
    toggle() {
      if (this.open) {
        this.close();
        return;
      }
      const button = this.$refs.button;
      // Just below the button, across the section
      this.panelStyle = { top: `${button.offsetTop + button.offsetHeight + 4}px` };
      this.open = true;
      document.addEventListener('click', this.close);
      document.addEventListener('keydown', this.closeOnEscape);
    },
    close() {
      this.open = false;
      document.removeEventListener('click', this.close);
      document.removeEventListener('keydown', this.closeOnEscape);
    },
    closeOnEscape(event) {
      if (event.key === 'Escape') {
        // Handled, so the extension's panel doesn't close as well
        event.preventDefault();
        this.close();
        this.$refs.button?.focus();
      }
    },
  },
  beforeUnmount() {
    this.close();
  },
};
</script>

<style lang="scss" scoped>
.helpTip {
  display: inline-flex;
  vertical-align: middle;
}

.helpButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  font: inherit;
  color: inherit;
  background: none;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  opacity: 0.7;

  &:hover,
  &[aria-expanded='true'] {
    opacity: 1;
    background: rgba(127, 127, 127, 0.2);
  }

  &:focus-visible {
    outline: 2px solid var(--teamSecondaryColor);
  }

  .material-icons {
    font-size: 20px;
  }
}

.helpPanel {
  position: absolute;
  left: 1em;
  right: 1em;
  z-index: 20;
  display: block;
  max-width: 40em;
  padding: 0.6em 0.8em;
  font-size: 0.9em;
  font-weight: normal;
  line-height: 1.45;
  text-align: left;
  text-transform: none;
  white-space: normal;
  color: var(--themeAccentColor);
  background: var(--themeBaseColor);
  border: 1px solid var(--teamSecondaryColor);
  border-radius: 6px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);

  :deep(p) {
    margin: 0 0 0.5em;

    &:last-child {
      margin-bottom: 0;
    }
  }
}
</style>
