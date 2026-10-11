<template>
  <!-- Keyed by path, so opening another league starts fresh with that league's saved state.
       Only the tab changes the query, which keeps the same view. -->
  <router-view :key="$route.path"></router-view>
</template>
