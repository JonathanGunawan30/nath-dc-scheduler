const test = require('node:test');
const assert = require('node:assert/strict');
const { loadConfig } = require('../src/config');

function validEnvironment() {
    return {
        DISCORD_TOKEN: 'token',
        CHANNEL_ID: '12345678901234567',
        MESSAGE: 'Pesan pengujian',
        MIN_DELAY_MINUTES: '120',
        MAX_DELAY_MINUTES: '180',
        RETRY_DELAY_MINUTES: '5',
        MAX_RETRY_DELAY_MINUTES: '60',
        LOGIN_TIMEOUT_SECONDS: '30',
        CLIENT_BUILD_NUMBER: '66416',
    };
}

test('mengubah konfigurasi environment ke satuan milidetik', () => {
    const config = loadConfig(validEnvironment());

    assert.equal(config.minDelayMs, 7_200_000);
    assert.equal(config.maxDelayMs, 10_800_000);
    assert.equal(config.retryDelayMs, 300_000);
    assert.equal(config.maxRetryDelayMs, 3_600_000);
    assert.equal(config.loginTimeoutMs, 30_000);
    assert.equal(config.clientBuildNumber, 66_416);
    assert.equal(config.message, 'Pesan pengujian');
    assert.equal(Object.isFrozen(config), true);
});

test('menolak konfigurasi wajib yang kosong', () => {
    assert.throws(
        () => loadConfig({}),
        error => {
            assert.match(error.message, /DISCORD_TOKEN wajib diisi/);
            assert.match(error.message, /CHANNEL_ID harus berupa ID Discord/);
            assert.match(error.message, /MESSAGE tidak boleh kosong/);
            return true;
        }
    );
});

test('menolak rentang delay yang terbalik', () => {
    const env = validEnvironment();
    env.MIN_DELAY_MINUTES = '181';

    assert.throws(
        () => loadConfig(env),
        /MIN_DELAY_MINUTES tidak boleh lebih besar dari MAX_DELAY_MINUTES/
    );
});
