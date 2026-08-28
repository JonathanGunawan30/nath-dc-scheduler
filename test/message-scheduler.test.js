const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const {
    MessageScheduler,
    isIgnorableClientError,
} = require('../src/message-scheduler');

function config() {
    return {
        token: 'token',
        channelId: '12345678901234567',
        message: 'Pesan pengujian',
        minDelayMs: 100,
        maxDelayMs: 200,
        retryDelayMs: 10,
        maxRetryDelayMs: 80,
        loginTimeoutMs: 100,
    };
}

function logger() {
    return { info() {}, error() {} };
}

function client({ sendError } = {}) {
    const instance = new EventEmitter();
    const state = { destroyed: 0, sent: [] };

    instance.user = { username: 'tester' };
    instance.login = async token => {
        assert.equal(token, 'token');
    };
    instance.channels = {
        fetch: async channelId => {
            assert.equal(channelId, '12345678901234567');

            return {
                send: async message => {
                    state.sent.push(message);

                    if (sendError) {
                        throw sendError;
                    }

                    return { id: 'message-id' };
                },
            };
        },
    };
    instance.destroy = () => {
        state.destroyed += 1;
    };

    return { instance, state };
}

test('mengirim pesan dan selalu memutus client', async () => {
    const fake = client();
    const scheduler = new MessageScheduler({
        config: config(),
        logger: logger(),
        createClient: () => fake.instance,
    });

    await scheduler.deliver();

    assert.deepEqual(fake.state.sent, ['Pesan pengujian']);
    assert.equal(fake.state.destroyed, 1);
    assert.equal(scheduler.activeClient, null);
});

test('memutus client saat pengiriman gagal', async () => {
    const fake = client({ sendError: new Error('send failed') });
    const scheduler = new MessageScheduler({
        config: config(),
        logger: logger(),
        createClient: () => fake.instance,
    });

    await assert.rejects(() => scheduler.deliver(), /send failed/);

    assert.equal(fake.state.destroyed, 1);
    assert.equal(scheduler.activeClient, null);
});

test('menjadwalkan retry setelah siklus gagal', async () => {
    const fake = client({ sendError: new Error('send failed') });
    const scheduler = new MessageScheduler({
        config: config(),
        logger: logger(),
        createClient: () => fake.instance,
    });
    const schedules = [];

    scheduler.stopped = false;
    scheduler.schedule = (delayMs, reason) => schedules.push({ delayMs, reason });

    await scheduler.run();

    assert.deepEqual(schedules, [{ delayMs: 10, reason: 'deliveryFailure' }]);
    assert.equal(scheduler.failureCount, 1);
});

test('mengabaikan error worker yang berhenti saat disconnect', () => {
    assert.equal(
        isIgnorableClientError(new Error('Worker stopped with exit code 1')),
        true
    );
    assert.equal(isIgnorableClientError(new Error('Connection failed')), false);
});
