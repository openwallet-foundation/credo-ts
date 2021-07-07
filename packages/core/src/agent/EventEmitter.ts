import type { BaseEvent } from './Events'
import type { EventEmitter as NativeEventEmitter } from 'events'

import { fromEventPattern } from 'rxjs'
import { inject, Lifecycle, scoped } from 'tsyringe'

import { InjectionSymbols } from '../constants'

@scoped(Lifecycle.ContainerScoped)
export class EventEmitter {
  private eventEmitter: NativeEventEmitter

  public constructor(@inject(InjectionSymbols.NativeEventEmitter) NativeEventEmitterClass: typeof NativeEventEmitter) {
    this.eventEmitter = new NativeEventEmitterClass()
  }

  public emit<T extends BaseEvent>(data: T) {
    this.eventEmitter.emit(data.type, data)
  }

  public on<T extends BaseEvent>(event: T['type'], listener: (data: T) => void | Promise<void>) {
    this.eventEmitter.on(event, listener)
  }

  public off<T extends BaseEvent>(event: T['type'], listener: (data: T) => void | Promise<void>) {
    this.eventEmitter.off(event, listener)
  }

  public observable<T extends BaseEvent>(event: T['type']) {
    return fromEventPattern<T>(
      (handler) => this.on(event, handler),
      (handler) => this.off(event, handler)
    )
  }
}
