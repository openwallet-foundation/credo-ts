import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import type { DidCommConnectionService, DidCommDidRotateService } from '../services'

import { CredoError } from '@credo-ts/core'

import { DidCommDidRotateMessage } from '../messages'

export class DidCommDidRotateHandler implements DidCommMessageHandler {
  private didRotateService: DidCommDidRotateService
  private connectionService: DidCommConnectionService
  public supportedMessages = [DidCommDidRotateMessage]

  public constructor(didRotateService: DidCommDidRotateService, connectionService: DidCommConnectionService) {
    this.didRotateService = didRotateService
    this.connectionService = connectionService
  }

  public async handle(messageContext: DidCommMessageHandlerInboundMessage<DidCommDidRotateHandler>) {
    const { connection, recipientKey } = messageContext
    if (!connection) {
      throw new CredoError(`Connection for verkey ${recipientKey?.fingerprint} not found!`)
    }

    return this.didRotateService.processRotate(messageContext)
  }
}
