import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEventBus } from '../services/event-bus';

describe('createEventBus', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('on/emit delivers payload to subscribers', () => {
    const bus = createEventBus();
    const handler = vi.fn();
    bus.on('test:event', handler);
    bus.emit('test:event', { foo: 'bar' });
    expect(handler).toHaveBeenCalledWith({ foo: 'bar' });
  });

  it('on returns unsubscribe function', () => {
    const bus = createEventBus();
    const handler = vi.fn();
    const off = bus.on('test:event', handler);
    off();
    bus.emit('test:event', {});
    expect(handler).not.toHaveBeenCalled();
  });

  it('multiple subscribers all receive event', () => {
    const bus = createEventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on('test:event', h1);
    bus.on('test:event', h2);
    bus.emit('test:event', { x: 1 });
    expect(h1).toHaveBeenCalled();
    expect(h2).toHaveBeenCalled();
  });

  it('emit with no subscribers does not throw', () => {
    const bus = createEventBus();
    expect(() => bus.emit('orphan', {})).not.toThrow();
  });

  it('handler throwing does not break other handlers', () => {
    const bus = createEventBus();
    const h1 = vi.fn(() => {
      throw new Error('boom');
    });
    const h2 = vi.fn();
    bus.on('test:event', h1);
    bus.on('test:event', h2);
    bus.emit('test:event', {});
    expect(h2).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
  });
});
