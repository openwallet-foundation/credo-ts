import type { BaseEvent } from './Events'
import type { EventEmitter as NativeEventEmitter } from 'events'

import { fromEventPattern } from 'rxjs'
import { takeUntil } from 'rxjs/operators'
import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from './AgentConfig'

@scoped(Lifecycle.ContainerScoped)
export class EventEmitter {
  private agentConfig: AgentConfig
  private eventEmitter: NativeEventEmitter

  public constructor(agentConfig: AgentConfig) {
    this.agentConfig = agentConfig
    this.eventEmitter = new agentConfig.agentDependencies.EventEmitterClass()
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
    ).pipe(takeUntil(this.agentConfig.stop$))
  }
}
