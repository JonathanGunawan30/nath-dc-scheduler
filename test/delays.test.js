const test = require('node:test');
const assert = require('node:assert/strict');
const { getRandomDelay, getRetryDelay } = require('../src/delays');

test('menghasilkan batas minimum dan maksimum delay', () => {
    assert.equal(getRandomDelay(100, 200, () => 0), 100);
    assert.equal(getRandomDelay(100, 200, () => 0.999999), 200);
});

test('menaikkan retry secara eksponensial sampai batas maksimum', () => {
    assert.equal(getRetryDelay(5, 60, 1), 5);
    assert.equal(getRetryDelay(5, 60, 2), 10);
    assert.equal(getRetryDelay(5, 60, 3), 20);
    assert.equal(getRetryDelay(5, 60, 10), 60);
});
