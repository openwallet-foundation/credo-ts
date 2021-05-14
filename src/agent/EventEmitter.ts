import { Lifecycle, scoped } from 'tsyringe'
import { EventEmitter as NativeEventEmitter } from 'events'
import { BaseEvent } from './Events'

@scoped(Lifecycle.ContainerScoped)
export class EventEmitter {
  private eventEmitter = new NativeEventEmitter()

  public emit<T extends BaseEvent>(data: T) {
    this.eventEmitter.emit(data.type, data)
  }

  public on<T extends BaseEvent>(event: T['type'], listener: (data: T) => void | Promise<void>) {
    this.eventEmitter.on(event, listener)
  }

  public off<T extends BaseEvent>(event: T['type'], listener: (data: T) => void | Promise<void>) {
    this.eventEmitter.off(event, listener)
  }
}
