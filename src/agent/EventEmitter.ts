import type { BaseEvent } from './Events'
import type { Observable } from 'rxjs'

import { EventEmitter as NativeEventEmitter } from 'events'
import { fromEventPattern, Subject } from 'rxjs'
import { takeUntil } from 'rxjs/operators'
import { inject, Lifecycle, scoped } from 'tsyringe'

import { InjectionSymbols } from '../constants'

@scoped(Lifecycle.ContainerScoped)
export class EventEmitter {
  private $stop: Observable<boolean>
  private eventEmitter = new NativeEventEmitter()

  public constructor(@inject(InjectionSymbols.$Stop) $stop: Subject<boolean>) {
    this.$stop = $stop
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
    ).pipe(takeUntil(this.$stop))
  }
}
