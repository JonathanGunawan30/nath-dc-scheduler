const { loadConfig } = require('./src/config');
const { createLogger } = require('./src/logger');
const { MessageScheduler } = require('./src/message-scheduler');

const logger = createLogger();
let scheduler;
let shuttingDown = false;

function getSuperProperties(buildNumber) {
    const props = {
        os: 'Windows',
        browser: 'Chrome',
        device: '',
        system_locale: 'id-ID',
        has_client_mods: true,
        browser_user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
        browser_version: '152.0.0.0',
        os_version: '10',
        referrer: 'https://chatgpt.com/',
        referring_domain: 'chatgpt.com',
        referrer_current: 'https://www.google.com/',
        referring_domain_current: 'www.google.com',
        search_engine_current: 'google',
        release_channel: 'stable',
        client_build_number: buildNumber,
        client_event_source: null,
    };
    return Buffer.from(JSON.stringify(props)).toString('base64');
}

function loadClientConstructor(config) {
    const originalLog = console.log;
    console.log = () => {};

    try {
        const { Client } = require('discord.js-selfbot-youtsuho-v13');
        
        return class SpoofedClient extends Client {
            constructor(options = {}) {
                const spoofedOptions = {
                    ...options,
                    rest: {
                        ...options.rest,
                        headers: {
                            ...options.rest?.headers,
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
                            'X-Super-Properties': getSuperProperties(config.clientBuildNumber),
                            'X-Discord-Locale': 'id',
                            'X-Discord-Timezone': 'Asia/Jakarta',
                            'Accept-Encoding': 'gzip, deflate, br',
                            'Accept-Language': 'id,en-US;q=0.9,en;q=0.8',
                        }
                    }
                };
                super(spoofedOptions);
            }
        };
    } finally {
        console.log = originalLog;
    }
}

async function shutdown(signal, exitCode = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('Shutdown dimulai', { signal });

    if (scheduler) {
        await scheduler.stop();
    }

    process.exitCode = exitCode;
    logger.info('Shutdown selesai', { exitCode });
}

async function main() {
    process.loadEnvFile();

    const config = loadConfig(process.env);
    const Client = loadClientConstructor(config);

    scheduler = new MessageScheduler({
        config,
        logger,
        createClient: () => new Client(),
    });

    scheduler.start();
}

process.once('SIGINT', () => { void shutdown('SIGINT'); });
process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
process.once('unhandledRejection', error => {
    logger.error('Unhandled rejection', { error });
    void shutdown('unhandledRejection', 1);
});
process.once('uncaughtException', error => {
    logger.error('Uncaught exception', { error });
    void shutdown('uncaughtException', 1);
});

main().catch(error => {
    logger.error('Aplikasi gagal dijalankan', { error });
    void shutdown('startupError', 1);
});