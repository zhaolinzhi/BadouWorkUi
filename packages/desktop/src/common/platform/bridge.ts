/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import EventEmitter from 'eventemitter3';

type MaybePromise<T> = T | Promise<T>;
type EventHandler = (...args: unknown[]) => unknown;
type Interceptor = (params: { name: string; data: unknown }) => Promise<void>;

export type BridgeEventEmitter = {
  emit: (name: string, data: unknown, ...args: unknown[]) => unknown;
};

export type BridgeAdapter = {
  emit: (name: string, data: unknown, ...args: unknown[]) => unknown;
  on: (emitter: BridgeEventEmitter) => void | (() => void);
};

type ProviderHandler<Data, Params> = [Params] extends [void]
  ? () => MaybePromise<Data>
  : (params: Params) => MaybePromise<Data>;

type ProviderInvoke<Data, Params> = [Params] extends [void] ? () => Promise<Data> : (params: Params) => Promise<Data>;

type EmitterHandler<Params> = [Params] extends [void] ? () => void : (params: Params) => void;
type EmitterEmit<Params> = [Params] extends [void] ? () => void : (params: Params) => void;

const eventEmitter = new EventEmitter();
const interceptors: Interceptor[] = [];
const listenerWrappers = new Map<string, Map<EventHandler, Set<EventHandler>>>();
const noop = (): void => {};

let emitToAdapter: BridgeAdapter['emit'] = () => undefined;
let disconnectAdapter: (() => void) | undefined;

const createRequestId = (key: string): string => `${key}${Math.random().toString(16).slice(2, 10)}`;

export const adapter = (config: BridgeAdapter): void => {
  disconnectAdapter?.();
  emitToAdapter = config.emit;
  const disconnect = config.on({
    emit(name, data, ...args) {
      return eventEmitter.emit(name, data, ...args);
    },
  });
  disconnectAdapter = typeof disconnect === 'function' ? disconnect : undefined;
};

export const emit = (name: string, data?: unknown, ...args: unknown[]): void => {
  emitToAdapter(name, data, ...args);
};

export const off = (name: string, callback: EventHandler): void => {
  const wrappers = listenerWrappers.get(name)?.get(callback);
  if (!wrappers) {
    eventEmitter.off(name, callback);
    return;
  }

  for (const wrapper of wrappers) {
    eventEmitter.off(name, wrapper);
  }
  listenerWrappers.get(name)?.delete(callback);
  if (listenerWrappers.get(name)?.size === 0) {
    listenerWrappers.delete(name);
  }
};

export const on = (name: string, callback: EventHandler): (() => void) => {
  const wrapped: EventHandler = (...args) => {
    if (/^subscribe(\.callback)?-/.test(name) || interceptors.length === 0) {
      return callback(...args);
    }

    void Promise.all(interceptors.map((interceptor) => interceptor({ name, data: args[0] }))).then(() =>
      callback(...args)
    );
    return undefined;
  };

  let callbacks = listenerWrappers.get(name);
  if (!callbacks) {
    callbacks = new Map();
    listenerWrappers.set(name, callbacks);
  }
  let wrappers = callbacks.get(callback);
  if (!wrappers) {
    wrappers = new Set();
    callbacks.set(callback, wrappers);
  }
  wrappers.add(wrapped);
  eventEmitter.on(name, wrapped);

  return () => {
    eventEmitter.off(name, wrapped);
    wrappers.delete(wrapped);
    if (wrappers.size === 0) {
      callbacks.delete(callback);
    }
    if (callbacks.size === 0) {
      listenerWrappers.delete(name);
    }
  };
};

export const intercept = (callback: Interceptor): (() => void) => {
  interceptors.push(callback);
  return () => {
    const index = interceptors.indexOf(callback);
    if (index >= 0) {
      interceptors.splice(index, 1);
    }
  };
};

export const subscribe = <Params = unknown, Data = unknown>(
  name: string,
  handler: (data: Params) => MaybePromise<Data>
): (() => void) =>
  on(`subscribe-${name}`, (request) => {
    // Note: no `'data' in request` check — void-param invokes send
    // `data: undefined`, and JSON transports (Electron IPC, WebSocket)
    // strip undefined values, so the key is legitimately absent on the wire.
    if (typeof request !== 'object' || request === null || !('id' in request) || typeof request.id !== 'string') {
      return;
    }

    // `Promise.resolve(handler(...))` does NOT catch a synchronous throw: the
    // handler runs before the promise exists, so the throw escapes and the
    // callback is never emitted. Wrap the call so both a synchronous throw
    // and a rejected promise reach the same failure path.
    let result: MaybePromise<Data>;
    try {
      result = handler((request as { data?: Params }).data as Params);
    } catch (error) {
      result = Promise.reject(error);
    }

    Promise.resolve(result)
      .then((value) => emit(`subscribe.callback-${name}${request.id}`, value))
      .catch((error: unknown) => {
        console.error(`[bridge] Provider "${name}" failed:`, error);
        // Report the failure back to the caller. Without this the invokeer's
        // promise never settles — it waits for a callback that will never
        // arrive — and anything awaiting it hangs forever. A provider that
        // throws is a normal failure (a backend that could not start, an
        // account switch that was cancelled), not a reason to wedge the
        // caller.
        emit(`subscribe.callback-${name}${request.id}`, {
          __bridgeError: { message: error instanceof Error ? error.message : String(error) },
        });
      });
  });

/**
 * The envelope a failed provider sends back instead of its result.
 *
 * The provider's error cannot cross the wire as-is (it may not be
 * serializable), so it is wrapped in a plain object the caller can unwrap.
 */
type BridgeErrorEnvelope = { __bridgeError?: { message: string } };

export const invoke = <Data = unknown>(name: string, data?: unknown): Promise<Data> => {
  const id = createRequestId(name);
  const callbackName = `subscribe.callback-${name}${id}`;

  return new Promise<Data>((resolve, reject) => {
    const dispose = on(callbackName, (result) => {
      dispose();
      const envelope = result as BridgeErrorEnvelope | undefined;
      if (envelope && typeof envelope === 'object' && envelope.__bridgeError) {
        reject(new Error(envelope.__bridgeError.message));
        return;
      }
      resolve(result as Data);
    });
    emit(`subscribe-${name}`, { id, data });
  });
};

export const buildProvider = <Data, Params = undefined>(key: string) => {
  let disposeProvider = noop;

  return {
    provider(handler: ProviderHandler<Data, Params>): () => void {
      disposeProvider();
      disposeProvider = subscribe<Params, Data>(key, handler as (params: Params) => MaybePromise<Data>);
      return disposeProvider;
    },
    invoke: ((params?: Params) => invoke<Data>(key, params)) as ProviderInvoke<Data, Params>,
  };
};

export const buildEmitter = <Params = undefined>(key: string) => ({
  on: ((callback: EmitterHandler<Params>) => on(key, callback as EventHandler)) as (
    callback: EmitterHandler<Params>
  ) => () => void,
  emit: ((params?: Params) => emit(key, params)) as EmitterEmit<Params>,
});

export const bridge = {
  adapter,
  buildEmitter,
  buildProvider,
  emit,
  intercept,
  invoke,
  off,
  on,
  subscribe,
};
