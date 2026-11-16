import { fromEventPattern, Subject } from 'rxjs'
import { takeUntil } from 'rxjs/operators'
import { InjectionSymbols } from '../constants'
import { inject, injectable } from '../plugins'
import type { AgentDependencies, EventEmitterLike } from './AgentDependencies'
import type { AgentContext } from './context'
import type { BaseEvent } from './Events'

type EmitEvent<T extends BaseEvent> = Omit<T, 'metadata'>

@injectable()
export class EventEmitter {
  private eventEmitter: EventEmitterLike
  private stop$: Subject<boolean>

  public constructor(
    @inject(InjectionSymbols.AgentDependencies) agentDependencies: AgentDependencies,
    @inject(InjectionSymbols.Stop$) stop$: Subject<boolean>
  ) {
    this.eventEmitter = new agentDependencies.EventEmitterClass()
    this.stop$ = stop$
  }

  /**
   * Calls the listeners synchronously. Promises returned by async listeners go to {@link AgentConfig.waitUntil}.
   *
   * @returns a promise that resolves once the async listeners have settled. It never rejects. Awaiting it is optional.
   */
  public emit<T extends BaseEvent>(agentContext: AgentContext, data: EmitEvent<T>): Promise<void> {
    const event = {
      ...data,
      metadata: {
        contextCorrelationId: agentContext.contextCorrelationId,
      },
    }

    // Calls the listeners itself, as an emitter's own emit drops the promises they return
    const pending = this.eventEmitter
      .listeners(data.type)
      .map((listener) => listener.call(this.eventEmitter, event))
      .filter((result) => result instanceof Promise)
    if (pending.length === 0) return Promise.resolve()

    // waitUntil logs failing listeners, so the returned promise doesn't reject
    for (const promise of pending) agentContext.config.waitUntil(promise)
    return Promise.allSettled(pending).then(() => undefined)
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
