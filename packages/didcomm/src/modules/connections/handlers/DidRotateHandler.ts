import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import type { ConnectionService, DidRotateService } from '../services'

import { CredoError } from '@credo-ts/core'

import { DidRotateMessage } from '../messages'

export class DidRotateHandler implements DidCommMessageHandler {
  private didRotateService: DidRotateService
  private connectionService: ConnectionService
  public supportedMessages = [DidRotateMessage]

  public constructor(didRotateService: DidRotateService, connectionService: ConnectionService) {
    this.didRotateService = didRotateService
    this.connectionService = connectionService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidRotateHandler>) {
    const { connection, recipientKey } = messageContext
    if (!connection) {
      throw new CredoError(`Connection for verkey ${recipientKey?.fingerprint} not found!`)
    }

    return this.didRotateService.processRotate(messageContext)
  }
}
