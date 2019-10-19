import { DisposableI } from '../disposable';
import uuid = require('uuid/v4');

export type EventHandler<T> = (value: T) => void;

export class EventHandlerRegistrar implements DisposableI {
  public constructor(private unregisterFunc: () => void) {}
  public dispose() {
    this.unregisterFunc();
  }
}

export class EventSource<T> {
  private handlers = new Map<string, EventHandler<T>>();

  public register(handler: EventHandler<T>): EventHandlerRegistrar {
    let handlerId = uuid();
    this.handlers.set(handlerId, handler);
    let source = this;
    return new EventHandlerRegistrar(() => {
      if (source) {
        source.unregister(handlerId);
      }
    });
  }

  public unregister(handlerId: string) {
    this.handlers.delete(handlerId);
  }

  public notify(value: T) {
    this.handlers.forEach((h) => h(value));
  }
}

export function isEventSource<T>(obj: any): obj is EventSource<T> {
  return obj.handler instanceof Map;
}
