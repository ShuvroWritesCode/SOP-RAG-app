const { defineConfig } = require('@vue/cli-service')

const backendProxy = {
  target: 'http://backend:3000',
  changeOrigin: true,
  // Skip proxy for browser navigation (HTML requests) so Vue Router handles them
  bypass(req) {
    if (req.headers.accept && req.headers.accept.includes('text/html')) {
      return req.url; // return the URL to serve from dev server instead
    }
  },
};

module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    port: 8080,
    host: '0.0.0.0',
    allowedHosts: 'all',
    client: {
      webSocketURL: 'auto://0.0.0.0:0/ws'
    },
    proxy: {
      '/api': backendProxy,
      '/auth': backendProxy,
      '/users': backendProxy,
      '/projects': backendProxy,
      '/bots': backendProxy,
      '/openai-knowledge': backendProxy,
      '/conversations': backendProxy,
      '/ai-models': backendProxy,
    }
  }
})
