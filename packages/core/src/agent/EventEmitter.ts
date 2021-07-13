import type { BaseEvent } from './Events'
import type { EventEmitter as NativeEventEmitter } from 'events'
import type { Observable } from 'rxjs'

import { fromEventPattern, Subject } from 'rxjs'
import { takeUntil } from 'rxjs/operators'
import { inject, Lifecycle, scoped } from 'tsyringe'

import { InjectionSymbols } from '../constants'

import { AgentConfig } from './AgentConfig'

@scoped(Lifecycle.ContainerScoped)
export class EventEmitter {
  private eventEmitter: NativeEventEmitter
  private $stop: Observable<boolean>

  public constructor(@inject(InjectionSymbols.$Stop) $stop: Subject<boolean>, agentConfig: AgentConfig) {
    this.eventEmitter = new agentConfig.agentDependencies.NativeEventEmitter()
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
