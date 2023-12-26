import type { AgentContext } from '../../../agent'
import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { ConnectionRecord } from '../repository/ConnectionRecord'

import { EventEmitter } from '../../../agent/EventEmitter'
import { OutboundMessageContext } from '../../../agent/models'
import { InjectionSymbols } from '../../../constants'
import { Logger } from '../../../logger'
import { inject, injectable } from '../../../plugins'
import { AckStatus } from '../../common'
import { DidResolverService, PeerDidNumAlgo, getNumAlgoFromPeerDid, isValidPeerDid } from '../../dids'
import { RotateMessage, RotateAckMessage, DidRotateProblemReportMessage } from '../messages'

import { ConnectionService } from './ConnectionService'

@injectable()
export class DidRotateService {
  private eventEmitter: EventEmitter
  private didResolverService: DidResolverService
  private logger: Logger

  public constructor(
    eventEmitter: EventEmitter,
    didResolverService: DidResolverService,
    @inject(InjectionSymbols.Logger) logger: Logger
  ) {
    this.eventEmitter = eventEmitter
    this.didResolverService = didResolverService
    this.logger = logger
  }

  public async createRotate(agentContext: AgentContext, options: { connection: ConnectionRecord; did: string }) {
    const { connection, did } = options

    // TODO: update connection

    return new RotateMessage({ did })
  }

  /**
   * Process an incoming DID Rotate message and update connection if success. Any acknowledge
   * or problem report will be sent to the prior DID, so the created context will take former
   * connection record data
   *
   * @param param
   * @param connection
   * @returns
   */
  public async processRotate(
    { message, agentContext }: InboundMessageContext<RotateMessage>,
    connection: ConnectionRecord
  ) {
    // Check and store their new did
    const did = message.did

    // DID Rotation not supported for peer:1 dids, as we need explicit did document information
    if (isValidPeerDid(did) && getNumAlgoFromPeerDid(did) === PeerDidNumAlgo.GenesisDoc) {
      this.logger.error(`Unable to resolve DID Document for '${did}`)

      const response = new DidRotateProblemReportMessage({
        description: { en: 'DID Method Unsupported', code: 'e.did.method_unsupported' },
      })
      return new OutboundMessageContext(response, { agentContext, connection })
    }

    const didDocumentResult = await this.didResolverService.resolve(agentContext, did)

    // Cannot resolve did
    if (!didDocumentResult.didDocument) {
      this.logger.error(`Unable to resolve DID Document for '${did}`)

      const response = new DidRotateProblemReportMessage({
        description: { en: 'DID Unresolvable', code: 'e.did.unresolvable' },
      })
      return new OutboundMessageContext(response, { agentContext, connection })
    }

    // Did is resolved but no compatible DIDComm services found
    if (!didDocumentResult.didDocument?.didCommServices) {
      const response = new DidRotateProblemReportMessage({
        description: { en: 'DID Document Unsupported', code: 'e.did.doc_unsupported' },
      })
      return new OutboundMessageContext(response, { agentContext, connection })
    }

    // Send acknowledge to previous did and persist new did. No further messages will be
    // accepted from previous did after this
    const outboundMessageContext = new OutboundMessageContext(
      new RotateAckMessage({
        threadId: message.threadId,
        status: AckStatus.OK,
      }),
      { agentContext, connection: connection.clone() }
    )

    connection.theirDid = did
    await agentContext.dependencyManager.resolve(ConnectionService).update(agentContext, connection)

    return outboundMessageContext
  }

  public processRotateAck(inboundMessage: InboundMessageContext<RotateAckMessage>) {
    const { agentContext, message } = inboundMessage

    const connection = inboundMessage.assertReadyConnection()
  }
}
