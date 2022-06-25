import type { DependencyManager } from '../../plugins'
import type { BasicMessageTags } from './repository/BasicMessageRecord'

import { AgentContext } from '../../agent'
import { Dispatcher } from '../../agent/Dispatcher'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { injectable, module } from '../../plugins'
import { ConnectionService } from '../connections'

import { BasicMessageHandler } from './handlers'
import { BasicMessageRepository } from './repository'
import { BasicMessageService } from './services'

@module()
@injectable()
export class BasicMessagesModule {
  private basicMessageService: BasicMessageService
  private messageSender: MessageSender
  private connectionService: ConnectionService
  private agentContext: AgentContext

  public constructor(
    dispatcher: Dispatcher,
    basicMessageService: BasicMessageService,
    messageSender: MessageSender,
    connectionService: ConnectionService,
    agentContext: AgentContext
  ) {
    this.basicMessageService = basicMessageService
    this.messageSender = messageSender
    this.connectionService = connectionService
    this.agentContext = agentContext
    this.registerHandlers(dispatcher)
  }

  public async sendMessage(connectionId: string, message: string) {
    const connection = await this.connectionService.getById(this.agentContext, connectionId)

    const basicMessage = await this.basicMessageService.createMessage(this.agentContext, message, connection)
    const outboundMessage = createOutboundMessage(connection, basicMessage)
    await this.messageSender.sendMessage(this.agentContext, outboundMessage)
  }

  public async findAllByQuery(query: Partial<BasicMessageTags>) {
    return this.basicMessageService.findAllByQuery(this.agentContext, query)
  }

  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new BasicMessageHandler(this.basicMessageService))
  }

  /**
   * Registers the dependencies of the basic message module on the dependency manager.
   */
  public static register(dependencyManager: DependencyManager) {
    // Api
    dependencyManager.registerContextScoped(BasicMessagesModule)

    // Services
    dependencyManager.registerSingleton(BasicMessageService)

    // Repositories
    dependencyManager.registerSingleton(BasicMessageRepository)
  }
}
