/**
 * 跨应用事件总线。
 * 主应用 → 子应用、子应用 → 主应用通信。
 * 内部用 EventTarget，子应用通过 props.on/emit 使用。
 */

export interface MicroAppEventBus {
  on: (event: string, handler: (payload: unknown) => void) => () => void;
  emit: (event: string, payload: unknown) => void;
}

export function createEventBus(): MicroAppEventBus {
  const target = new EventTarget();

  return {
    on(event: string, handler: (payload: unknown) => void) {
      const listener = (e: Event) => {
        try {
          handler((e as CustomEvent).detail);
        } catch (err) {
          console.error(`[event-bus] handler for "${event}" threw:`, err);
        }
      };
      target.addEventListener(event, listener);
      return () => target.removeEventListener(event, listener);
    },
    emit(event: string, payload: unknown) {
      target.dispatchEvent(new CustomEvent(event, { detail: payload }));
    },
  };
}

/**
 * 全局唯一的事件总线。
 *
 * 调用方**必须**共用这一个实例,否则事件发出去没人收:总线是普通对象,
 * `createEventBus()` 每次都造一个新的 EventTarget。之前的写法有三处各自
 * `createEventBus()`(MicroAppBootstrap、startMicroApps、MicroAppHost 的
 * props 兜底),子应用的 `emit('auth:expired')` 落进了一个没有订阅者的实例。
 */
let sharedBus: MicroAppEventBus | null = null;

export function getEventBus(): MicroAppEventBus {
  if (!sharedBus) sharedBus = createEventBus();
  return sharedBus;
}
