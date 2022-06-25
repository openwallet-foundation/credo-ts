import type { BaseEvent } from './Events'
import type { AgentContext } from './context'
import type { EventEmitter as NativeEventEmitter } from 'events'

import { fromEventPattern, Subject } from 'rxjs'
import { takeUntil } from 'rxjs/operators'

import { InjectionSymbols } from '../constants'
import { injectable, inject } from '../plugins'

import { AgentDependencies } from './AgentDependencies'

@injectable()
export class EventEmitter {
  private eventEmitter: NativeEventEmitter
  private stop$: Subject<boolean>

  public constructor(
    @inject(InjectionSymbols.AgentDependencies) agentDependencies: AgentDependencies,
    @inject(InjectionSymbols.Stop$) stop$: Subject<boolean>
  ) {
    this.eventEmitter = new agentDependencies.EventEmitterClass()
    this.stop$ = stop$
  }

  // agentContext is currently not used, but already making required as it will be used soon
  public emit<T extends BaseEvent>(agentContext: AgentContext, data: T) {
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
    ).pipe(takeUntil(this.stop$))
  }
}
