import { getAlternativeDidsForPeerDid, isValidPeerDid } from '@credo-ts/core'

import type { DidCommMessageHandler, DidCommMessageHandlerInboundMessage } from '../../../handlers'
import { DidCommEmptyMessage } from '../../../messages'
import type { DidCommConnectionRecord } from '../repository'
import {
  DidCommConnectionService,
  DidCommDidRotateService,
  DidCommFromPriorService,
  type FromPriorPayload,
} from '../services'

/**
 * Handle a DIDComm V2 `empty/1.0/empty` message. If it carries a `from_prior` JWT with no `sub`,
 * the sender is signaling end-of-relationship per
 * https://identity.foundation/didcomm-messaging/spec/v2.1/#ending-a-relationship.
 *
 * Other empty messages are no-ops.
 */
export class DidCommEmptyMessageHandler implements DidCommMessageHandler {
  public supportedMessages = [DidCommEmptyMessage]

  private fromPriorService: DidCommFromPriorService
  private didRotateService: DidCommDidRotateService
  private connectionService: DidCommConnectionService

  public constructor(
    fromPriorService: DidCommFromPriorService,
    didRotateService: DidCommDidRotateService,
    connectionService: DidCommConnectionService
  ) {
    this.fromPriorService = fromPriorService
    this.didRotateService = didRotateService
    this.connectionService = connectionService
  }

  public async handle(inbound: DidCommMessageHandlerInboundMessage<DidCommEmptyMessageHandler>) {
    const { agentContext } = inbound
    const jws = inbound.message.fromPrior
    if (!jws) return undefined

    let payload: FromPriorPayload
    try {
      payload = await this.fromPriorService.verify(agentContext, jws)
    } catch (error) {
      agentContext.config.logger.warn('Ignoring empty message with invalid from_prior JWT', {
        error: error instanceof Error ? error.message : String(error),
      })
      return undefined
    }

    if (payload.sub !== undefined) return undefined

    const connection = await this.findConnectionByIss(agentContext, payload.iss)
    if (!connection) {
      agentContext.config.logger.debug('Received V2 termination signal but no matching connection', {
        iss: payload.iss,
      })
      return undefined
    }

    await this.didRotateService.processRotateToNothing(agentContext, connection)
    return undefined
  }

  /**
   * Locate the connection for the sender of the termination signal. The JWT iss may be either
   * the short or long form of a did:peer:4; the connection record may have been stored with the
   * opposite form. Try exact match, then DidRecord canonical-form fallback, then peer:4
   * deterministic alternative forms.
   */
  private async findConnectionByIss(
    agentContext: import('@credo-ts/core').AgentContext,
    iss: string
  ): Promise<DidCommConnectionRecord | null> {
    const direct = await this.connectionService.findByTheirDidOrSender(agentContext, { theirDid: iss })
    if (direct) return direct

    if (!isValidPeerDid(iss)) return null

    const alternatives = getAlternativeDidsForPeerDid(iss) ?? []
    for (const alt of alternatives) {
      if (alt === iss) continue
      const found = await this.connectionService.findByTheirDidOrSender(agentContext, { theirDid: alt })
      if (found) return found
    }

    return null
  }
}
