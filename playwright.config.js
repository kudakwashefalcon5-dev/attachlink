const {defineConfig} = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests/e2e',
    timeout: 120000,
    workers: 1,
    use: {
        baseURL: process.env.ATTACHLINK_E2E_URL || 'http://127.0.0.1:18745',
        channel: process.env.ATTACHLINK_E2E_CHANNEL || 'msedge',
        trace: 'retain-on-failure',
    },
});
