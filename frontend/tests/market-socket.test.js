import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarketSocket } from '../src/api.js';

test('reconnects after disconnection and stops all reconnects on cleanup', () => {
  const originals = { window: globalThis.window, WebSocket: globalThis.WebSocket, setTimeout, clearTimeout };
  const sockets = [];
  const pending = new Map();
  let disconnected = 0;
  const messages = [];
  try {
    globalThis.window = { location: { protocol: 'https:', host: 'example.test' } };
    globalThis.WebSocket = class {
      constructor(url) { this.url = url; sockets.push(this); }
      close() { this.closed = true; this.onclose?.(); }
    };
    globalThis.setTimeout = callback => { pending.set(callback, callback); return callback; };
    globalThis.clearTimeout = id => pending.delete(id);
    const connection = createMarketSocket(data => messages.push(data), () => disconnected++);
    assert.equal(sockets[0].url, 'wss://example.test/ws/market');
    sockets[0].onmessage({ data: '{"type":"market_update"}' });
    assert.equal(messages[0].type, 'market_update');
    sockets[0].close();
    assert.equal(disconnected, 1);
    assert.equal(pending.size, 1);
    const reconnect = [...pending.keys()][0];
    pending.delete(reconnect);
    reconnect();
    assert.equal(sockets.length, 2);
    sockets[1].close();
    assert.equal(pending.size, 1);
    connection.close();
    assert.equal(pending.size, 0);
    assert.equal(sockets[1].closed, true);
    reconnect(); // A callback already queued before unmount must also be harmless.
    assert.equal(sockets.length, 2);
    sockets[1].onmessage({ data: '{"type":"late_message"}' });
    assert.equal(messages.length, 1);
  } finally {
    Object.assign(globalThis, originals);
  }
});
