function readPositiveNumber(env, name, errors) {
    const value = Number(env[name]);

    if (!Number.isFinite(value) || value <= 0) {
        errors.push(`${name} harus berupa angka positif.`);
    }

    return value;
}

function loadConfig(env) {
    const errors = [];
    const minDelayMinutes = readPositiveNumber(env, 'MIN_DELAY_MINUTES', errors);
    const maxDelayMinutes = readPositiveNumber(env, 'MAX_DELAY_MINUTES', errors);
    const retryDelayMinutes = readPositiveNumber(env, 'RETRY_DELAY_MINUTES', errors);
    const maxRetryDelayMinutes = readPositiveNumber(env, 'MAX_RETRY_DELAY_MINUTES', errors);
    const loginTimeoutSeconds = readPositiveNumber(env, 'LOGIN_TIMEOUT_SECONDS', errors);
    const clientBuildNumber = Number(env.CLIENT_BUILD_NUMBER);

    if (!Number.isFinite(clientBuildNumber) || clientBuildNumber <= 0) {
        errors.push('CLIENT_BUILD_NUMBER harus berupa angka positif.');
    }

    if (!env.DISCORD_TOKEN) {
        errors.push('DISCORD_TOKEN wajib diisi.');
    }

    if (!/^\d{17,20}$/.test(env.CHANNEL_ID)) {
        errors.push('CHANNEL_ID harus berupa ID Discord 17-20 digit.');
    }

    if (typeof env.MESSAGE !== 'string' || env.MESSAGE.trim().length === 0) {
        errors.push('MESSAGE tidak boleh kosong.');
    }

    if (env.MESSAGE && env.MESSAGE.length > 2000) {
        errors.push('MESSAGE tidak boleh melebihi 2000 karakter.');
    }

    if (
        Number.isFinite(minDelayMinutes) &&
        Number.isFinite(maxDelayMinutes) &&
        minDelayMinutes > maxDelayMinutes
    ) {
        errors.push('MIN_DELAY_MINUTES tidak boleh lebih besar dari MAX_DELAY_MINUTES.');
    }

    if (
        Number.isFinite(retryDelayMinutes) &&
        Number.isFinite(maxRetryDelayMinutes) &&
        retryDelayMinutes > maxRetryDelayMinutes
    ) {
        errors.push('RETRY_DELAY_MINUTES tidak boleh lebih besar dari MAX_RETRY_DELAY_MINUTES.');
    }

    if (errors.length > 0) {
        throw new Error(`Konfigurasi tidak valid:\n- ${errors.join('\n- ')}`);
    }

    return Object.freeze({
        token: env.DISCORD_TOKEN,
        channelId: env.CHANNEL_ID,
        message: env.MESSAGE.trim(),
        minDelayMs: minDelayMinutes * 60 * 1000,
        maxDelayMs: maxDelayMinutes * 60 * 1000,
        retryDelayMs: retryDelayMinutes * 60 * 1000,
        maxRetryDelayMs: maxRetryDelayMinutes * 60 * 1000,
        loginTimeoutMs: loginTimeoutSeconds * 1000,
        clientBuildNumber: clientBuildNumber,
    });
}

module.exports = { loadConfig };
