import { Lifecycle, scoped } from 'tsyringe'

import { Dispatcher } from '../../agent/Dispatcher'
import { MessageSender } from '../../agent/MessageSender'
import { ConnectionService } from '../connections/services'

import { DiscloseMessageHandler, QueryMessageHandler } from './handlers'
import { DiscoverFeaturesService } from './services'

@scoped(Lifecycle.ContainerScoped)
export class DiscoverFeaturesModule {
  private connectionService: ConnectionService
  private messageSender: MessageSender
  private discoverFeaturesService: DiscoverFeaturesService

  public constructor(
    dispatcher: Dispatcher,
    connectionService: ConnectionService,
    messageSender: MessageSender,
    discoverFeaturesService: DiscoverFeaturesService
  ) {
    this.connectionService = connectionService
    this.messageSender = messageSender
    this.discoverFeaturesService = discoverFeaturesService
    this.registerHandlers(dispatcher)
  }

  public async queryFeatures(did: string, options: { query: string; comment?: string }) {
    const queryMessage = await this.discoverFeaturesService.createQuery(did, options)
    await this.messageSender.sendDIDCommV2Message(queryMessage)
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new DiscloseMessageHandler())
    dispatcher.registerHandler(new QueryMessageHandler(this.discoverFeaturesService))
  }
}
