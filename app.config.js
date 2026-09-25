// Веб-версия живёт на GitHub Pages по адресу /tempo-run — путь задаётся только при сборке сайта.
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    ...(process.env.WEB_BASE_URL ? { baseUrl: process.env.WEB_BASE_URL } : {}),
  },
});
