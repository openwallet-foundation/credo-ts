import type { InboundMessageContext } from '../../../../../agent/models/InboundMessageContext'
import type { ConnectionRecord } from '../../../repository/ConnectionRecord'

import { Dispatcher } from '../../../../../agent/Dispatcher'
import { InjectionSymbols } from '../../../../../constants'
import { Logger } from '../../../../../logger'
import { inject, injectable } from '../../../../../plugins'
import { ConnectionService } from '../../../services/ConnectionService'

import { TrustPingMessageHandler, TrustPingResponseMessageHandler } from './handlers'
import { TrustPingMessage } from './messages'
import { TrustPingResponseMessage } from './messages/TrustPingResponseMessage'

@injectable()
export class TrustPingService {
  private logger: Logger
  private dispatcher: Dispatcher
  private connectionService: ConnectionService

  public constructor(
    @inject(InjectionSymbols.Logger) logger: Logger,
    dispatcher: Dispatcher,
    connectionService: ConnectionService
  ) {
    this.logger = logger
    this.dispatcher = dispatcher
    this.connectionService = connectionService

    this.registerHandlers()
  }

  public createPing(): TrustPingMessage {
    return new TrustPingMessage({
      responseRequested: true,
    })
  }

  public processPing({ message }: InboundMessageContext<TrustPingMessage>, connection: ConnectionRecord) {
    this.logger.info(`Send Trust Ping message to connection ${connection.id}.`)
    if (message.responseRequested) {
      const response = new TrustPingResponseMessage({
        threadId: message.id,
      })

      return response
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public processPingResponse(inboundMessage: InboundMessageContext<TrustPingResponseMessage>) {
    this.logger.info('Trust Ping Response message received.')
    // TODO: handle ping response message
  }

  protected registerHandlers() {
    this.dispatcher.registerHandler(new TrustPingMessageHandler(this, this.connectionService))
    this.dispatcher.registerHandler(new TrustPingResponseMessageHandler(this))
  }
}
