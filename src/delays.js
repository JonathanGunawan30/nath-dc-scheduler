function getRandomDelay(min, max, random = Math.random) {
    return Math.floor(random() * (max - min + 1)) + min;
}

function getRetryDelay(base, maximum, failureCount) {
    return Math.min(base * (2 ** Math.max(0, failureCount - 1)), maximum);
}

function getHumanDelay(baseMs, varianceMs, random = Math.random) {
    return Math.floor(baseMs + (random() - 0.5) * varianceMs);
}

module.exports = { getRandomDelay, getRetryDelay, getHumanDelay };