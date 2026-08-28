const { getRandomDelay, getRetryDelay } = require('./delays');

function isIgnorableClientError(error) {
    return error?.message?.includes('Worker stopped with exit code 1') === true;
}

function withTimeout(promise, timeoutMs, message) {
    let timer;

    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    });

    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

class MessageScheduler {
    constructor({ config, logger, createClient, random = Math.random }) {
        this.config = config;
        this.logger = logger;
        this.createClient = createClient;
        this.random = random;
        this.timer = null;
        this.activeClient = null;
        this.running = false;
        this.stopped = true;
        this.failureCount = 0;
    }

    start() {
        if (!this.stopped) {
            return;
        }

        this.stopped = false;
        this.logger.info('Scheduler dimulai', { channelId: this.config.channelId });
        this.schedule(0, 'initial');
    }

    async stop() {
        this.stopped = true;

        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        if (this.activeClient) {
            const client = this.activeClient;
            this.activeClient = null;
            this.disconnect(client);
        }
    }

    schedule(delayMs, reason) {
        if (this.stopped) {
            return;
        }

        if (this.timer) {
            clearTimeout(this.timer);
        }

        const nextRunAt = new Date(Date.now() + delayMs).toISOString();
        this.logger.info('Siklus dijadwalkan', { reason, delayMs, nextRunAt });
        this.timer = setTimeout(() => {
            this.timer = null;
            void this.run();
        }, delayMs);
    }

    async run() {
        if (this.stopped || this.running) {
            return;
        }

        this.running = true;

        try {
            await this.deliver();
            this.failureCount = 0;

            const delayMs = getRandomDelay(
                this.config.minDelayMs,
                this.config.maxDelayMs,
                this.random
            );

            this.schedule(delayMs, 'deliverySuccess');
        } catch (error) {
            this.failureCount += 1;

            const delayMs = getRetryDelay(
                this.config.retryDelayMs,
                this.config.maxRetryDelayMs,
                this.failureCount
            );

            this.logger.error('Siklus gagal', {
                error,
                failureCount: this.failureCount,
                retryDelayMs: delayMs,
            });
            this.schedule(delayMs, 'deliveryFailure');
        } finally {
            this.running = false;
        }
    }

    async deliver() {
        const client = this.createClient();
        this.activeClient = client;

        client.on('error', error => {
            if (isIgnorableClientError(error)) {
                return;
            }

            this.logger.error('Client error', { error });
        });

        try {
            await withTimeout(
                client.login(this.config.token),
                this.config.loginTimeoutMs,
                'Login Discord melewati batas waktu.'
            );

            this.logger.info('Login berhasil', { username: client.user?.username });

            const channel = await client.channels.fetch(this.config.channelId);

            if (!channel || typeof channel.send !== 'function') {
                throw new Error('Channel tidak ditemukan atau tidak mendukung pengiriman pesan.');
            }

            if (typeof channel.sendTyping === 'function') {
                await channel.sendTyping();
                this.logger.info('Sedang mengetik...');
            }

            const typingDelay = getHumanDelay(3500, 3000);
            this.logger.info(`Menunggu ${(typingDelay/1000).toFixed(1)} detik...`);
            await sleep(typingDelay);

            const sentMessage = await channel.send(this.config.message);
            this.logger.info('Pesan berhasil dikirim', {
                channelId: this.config.channelId,
                messageId: sentMessage?.id,
            });

            const idleAfter = getHumanDelay(4000, 3000);
            this.logger.info(`Menunggu ${(idleAfter/1000).toFixed(1)} detik sebelum offline...`);
            await sleep(idleAfter);

        } finally {
            if (this.activeClient === client) {
                this.activeClient = null;
                this.disconnect(client);
            }
        }
    }

    disconnect(client) {
        try {
            client.destroy();
            this.logger.info('Client diputuskan');
        } catch (error) {
            if (isIgnorableClientError(error)) {
                return;
            }

            this.logger.error('Client gagal diputuskan', { error });
        }
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function getHumanDelay(baseMs, varianceMs) {
    return Math.floor(baseMs + (Math.random() - 0.5) * varianceMs);
}

module.exports = { MessageScheduler, withTimeout, isIgnorableClientError };
