<template>
  <div id="app" class="app-container">
    <template v-if="BACKGROUND">
      <video v-if="BACKGROUND.includes('.mp4')" autoplay muted loop id="backgroundVideo">
        <source :src="`/${BACKGROUND}`" type="video/mp4">
      </video>
      <img v-else :src="`/${BACKGROUND}`" id="backgroundVideo" />
    </template>
    <router-view v-if="loaded" />
    <footer class="global-footer" v-if="loaded">
      © 2026 | Developed and maintained by
      <a
        href="https://kaizenapps.com"
        target="_blank"
        rel="noopener noreferrer"
      >
        Kaizen Apps
      </a>
    </footer>
  </div>
</template>

<script>
export default {
  computed: {
    BACKGROUND() {
      const routeName = this.$route?.name;
      if (routeName && this['BACKGROUND_' + routeName + '_VIDEO']) {
        return this['BACKGROUND_' + routeName + '_VIDEO'];
      }
      return this.BACKGROUND_VIDEO;
    },
    isAuthRequired() {
      if (this.$route.name === undefined) {
        return null;
      }

      return this.$route.meta?.authRequired || false;
    }
  },
  watch: {
    isAuthRequired(val) {
      this.refreshAuth();
    }
  },
  data() {
    return {
      authRefreshTimer: null,
      isRefreshingAuth: false,
      loaded: false,
    }
  },
  methods: {
    async refreshAuth() {
      if (this.isRefreshingAuth) {
        return;
      }

      if (this.isAuthRequired == null) {
        this.loaded = false;
        return;
      }

      if (!this.$store.getters.getIsAuthSet) {
        this.loaded = true;
        return;
      }

      if (!this.isAuthRequired) {
        this.loaded = true;
        return;
      }

      this.isRefreshingAuth = true;

      try {
        await this.$store.dispatch('refreshAuth');
        await this.$store.dispatch('loadMe');
      } catch (ex) {
        console.error(ex);
      }

      this.loaded = true;

      this.isRefreshingAuth = false;
    }
  },
  created() {
    if (!this.$store.getters.getIsAuthSet && this.$route.meta.authRequired) {
      return this.$router.push({ name: "Login" });
    }
  },
  mounted() {
    this.refreshAuth();
    this.authRefreshTimer = setInterval(() => {
      this.refreshAuth();
    }, 60_000);
  },
  beforeUnmount() {
    if (this.authRefreshTimer) {
      clearInterval(this.authRefreshTimer);
    }
  }
}
</script>

<style>
.app-container {
  min-height: 100vh;
  position: relative;
  background-color: #0f172a;
  display: flex;
  flex-direction: column;
}

#backgroundVideo {
  position: fixed;
  right: 0;
  bottom: 0;
  min-width: 100%;
  min-height: 100%;
  z-index: -1;
  object-fit: cover;
}

.global-footer {
  margin-top: auto;
  text-align: center;
  padding: 14px 12px;
  color: #ffffff;
  background: rgba(15, 23, 42, 0.9);
  border-top: 1px solid #334155;
  font-size: 0.9rem;
}

.global-footer a {
  color: #ffffff;
  text-decoration: underline;
}

/* Modern scrollbar */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #0f172a;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: #475569;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}
</style>
