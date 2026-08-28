function serializeError(error) {
    if (!(error instanceof Error)) {
        return error;
    }

    return {
        name: error.name,
        message: error.message,
        stack: error.stack,
    };
}

function normalizeMetadata(metadata) {
    return Object.fromEntries(
        Object.entries(metadata).map(([key, value]) => [key, serializeError(value)])
    );
}

function createLogger(output = console) {
    function write(level, message, metadata = {}) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            ...normalizeMetadata(metadata),
        };

        const method = level === 'error' ? 'error' : 'log';
        output[method](JSON.stringify(entry));
    }

    return {
        info: (message, metadata) => write('info', message, metadata),
        error: (message, metadata) => write('error', message, metadata),
    };
}

module.exports = { createLogger };
