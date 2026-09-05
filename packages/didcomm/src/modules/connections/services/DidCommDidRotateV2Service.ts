import {
  type AgentContext,
  CredoError,
  type DidDocument,
  DidKey,
  DidRepository,
  DidResolverService,
  DidsApi,
  EventEmitter,
  getAlternativeDidsForPeerDid,
  getPublicJwkFromVerificationMethod,
  InjectionSymbols,
  inject,
  injectable,
  isValidPeerDid,
  JsonEncoder,
  JwsService,
  JwtPayload,
  type Logger,
  utils,
  type VerificationMethod,
} from '@credo-ts/core'
import { DidCommEventTypes, type DidCommMessageSentEvent } from '../../../DidCommEvents'
import { DidCommModuleConfig } from '../../../DidCommModuleConfig'
import { DidCommEmptyMessage } from '../../../messages'
import type { DidCommRouting } from '../../../models'
import { DidCommOutboundMessageContext, OutboundMessageSendStatus } from '../../../models'
import { DidCommDocumentService } from '../../../services/DidCommDocumentService'
import { DidCommV2EnvelopeService, type DidCommV2PlaintextMessage } from '../../../v2'
import { DidCommForwardV2Message } from '../../routing/protocol/v2/messages'
import { DidCommRoutingService } from '../../routing/services/DidCommRoutingService'
import { getMediationRecordForDidDocument } from '../../routing/services/helpers'
import type { DidCommConnectionDidRotatedEvent } from '../DidCommConnectionEvents'
import { DidCommConnectionEventTypes } from '../DidCommConnectionEvents'
import type { DidCommConnectionRecord } from '../repository'
import { DidCommConnectionMetadataKeys } from '../repository/DidCommConnectionMetadataTypes'
import { DidCommConnectionService } from './DidCommConnectionService'
import { createPeerDidForV2OOB, toKeyAgreement } from './helpers'

export interface FromPriorPayload {
  iss: string
  sub?: string
  iat: number
}

/**
 * Operations for DIDComm V2 DID rotation, including the rotate-to-nothing termination flow
 * (https://identity.foundation/didcomm-messaging/spec/v2.1/#ending-a-relationship) and
 * general `from_prior` based rotation (https://identity.foundation/didcomm-messaging/spec/v2.1/#did-rotation).
 *
 * Kept distinct from {@link DidCommDidRotateService}, which handles the v1 DID Rotate
 * protocol messages.
 */
@injectable()
export class DidCommDidRotateV2Service {
  private jwsService: JwsService
  private eventEmitter: EventEmitter
  private logger: Logger

  public constructor(
    jwsService: JwsService,
    eventEmitter: EventEmitter,
    @inject(InjectionSymbols.Logger) logger: Logger
  ) {
    this.jwsService = jwsService
    this.eventEmitter = eventEmitter
    this.logger = logger
  }

  /**
   * Rotate our DID on a v2 connection. If `toDid` is given, switch to it (must be a DID we own);
   * otherwise make a new peer DID from `routing`. Saves the new DID on the connection and stores the
   * from_prior JWT that later messages carry to tell the other side about the change.
   */
  public async rotateOurDid(
    agentContext: AgentContext,
    connection: DidCommConnectionRecord,
    options: { toDid?: string; routing?: DidCommRouting }
  ): Promise<{ newDid: string; fromPriorJwt: string }> {
    const { toDid, routing } = options
    if (!connection.did) {
      throw new CredoError(`Cannot rotate connection '${connection.id}': no current did`)
    }
    if (connection.didcommVersion !== 'v2') {
      throw new CredoError(
        `rotateOurDid only supports v2 connections; '${connection.id}' is ${connection.didcommVersion ?? 'v1'}`
      )
    }
    if (connection.metadata.get(DidCommConnectionMetadataKeys.DidRotateV2)) {
      throw new CredoError(`There is already an existing opened did rotation flow for connection id ${connection.id}`)
    }

    const priorDid = connection.did
    let newDid: string
    let mediatorId: string | undefined

    if (toDid) {
      const dids = agentContext.dependencyManager.resolve(DidsApi)
      const { didDocument } = await dids.resolveCreatedDidDocumentWithKeys(toDid)
      newDid = didDocument.id
      mediatorId = (await getMediationRecordForDidDocument(agentContext, didDocument))?.id
    } else {
      if (!routing) {
        throw new CredoError('Routing configuration must be defined when rotating to a new peer did')
      }
      const created = await createPeerDidForV2OOB(agentContext, routing)
      // Register the rotated DID with the mediator BEFORE committing the rotation, so a failed
      // registration cannot leave a connection whose inbound forwards the mediator can't route.
      const routingService = agentContext.dependencyManager.resolve(DidCommRoutingService)
      await routingService.registerRecipientDidForV2Routing(agentContext, routing, created.did)
      newDid = created.did
      mediatorId = routing.mediatorId
    }

    const fromPriorJwt = await this.createFromPriorForRotation(agentContext, priorDid, newDid)

    connection.previousDids = [...connection.previousDids, priorDid]
    connection.did = newDid
    if (mediatorId) connection.mediatorId = mediatorId
    connection.metadata.set(DidCommConnectionMetadataKeys.DidRotateV2, {
      fromPriorJwt,
      priorDid,
      newDid,
    })

    await agentContext.dependencyManager.resolve(DidCommConnectionService).update(agentContext, connection)

    return { newDid, fromPriorJwt }
  }

  /**
   * Returns the from_prior JWT to attach to the next outbound v2 message on this connection,
   * or undefined if no rotation is pending.
   */
  public getPendingFromPrior(connection: DidCommConnectionRecord): string | undefined {
    return connection.metadata.get(DidCommConnectionMetadataKeys.DidRotateV2)?.fromPriorJwt
  }

  /**
   * Clear pending-rotation metadata if the inbound message confirms the peer reached the new DID
   * (i.e. plaintext.to matches connection.did). Per
   * https://identity.foundation/didcomm-messaging/spec/v2.1/#did-rotation, from_prior must be
   * included on outbound messages "until the party rotating receives a message sent to the new DID".
   */
  public async clearPendingRotationIfAcknowledged(
    agentContext: AgentContext,
    connection: DidCommConnectionRecord,
    inboundTo: string[] | undefined
  ): Promise<void> {
    const pending = connection.metadata.get(DidCommConnectionMetadataKeys.DidRotateV2)
    if (!pending) return
    if (!inboundTo?.length || !connection.did) return
    if (!inboundTo.includes(connection.did) && inboundTo.every((to) => !this.didsEqual(to, connection.did as string)))
      return

    connection.metadata.delete(DidCommConnectionMetadataKeys.DidRotateV2)
    await agentContext.dependencyManager.resolve(DidCommConnectionService).update(agentContext, connection)
  }

  /**
   * Process an inbound from_prior JWT. Verifies the JWT, then either rotates theirDid to
   * `sub` (regular rotation) or clears theirDid (rotate-to-nothing termination).
   *
   * Idempotent: the sender retransmits from_prior on every outbound message until they
   * receive a message addressed to the new DID, so the same payload may arrive repeatedly.
   */
  public async processFromPrior(
    agentContext: AgentContext,
    connection: DidCommConnectionRecord,
    jws: string,
    senderDid: string | undefined
  ): Promise<FromPriorPayload | undefined> {
    let payload: FromPriorPayload
    try {
      payload = await this.verifyFromPrior(agentContext, jws)
    } catch (error) {
      this.logger.warn('Ignoring v2 message with invalid from_prior JWT', {
        error: error instanceof Error ? error.message : String(error),
      })
      return undefined
    }

    if (payload.sub === undefined) {
      if (connection.theirDid === undefined && connection.previousTheirDids.length > 0) return payload
      await this.processRotateToNothing(agentContext, connection)
      return payload
    }

    if (senderDid && payload.sub !== senderDid) {
      this.logger.warn("from_prior 'sub' does not match envelope 'from'; ignoring rotation", {
        sub: payload.sub,
        from: senderDid,
      })
      return payload
    }

    if (connection.theirDid === payload.sub) return payload

    await this.processRotateFromPeer(agentContext, connection, payload.iss, payload.sub)
    return payload
  }

  /**
   * Receiver-side rotation: peer announced they moved from `priorDid` to `newDid`.
   * Stores the new DID, updates connection.theirDid, pushes the old DID to previousTheirDids,
   * and emits the rotation event.
   */
  public async processRotateFromPeer(
    agentContext: AgentContext,
    connection: DidCommConnectionRecord,
    priorDid: string,
    newDid: string
  ): Promise<void> {
    const resolver = agentContext.dependencyManager.resolve(DidResolverService)
    const { didDocument } = await resolver.resolve(agentContext, newDid)
    if (!didDocument) {
      throw new CredoError(`Cannot resolve new DID '${newDid}' announced via from_prior`)
    }

    const didRepository = agentContext.dependencyManager.resolve(DidRepository)
    const existing = await didRepository.findReceivedDid(agentContext, newDid)
    if (!existing) {
      await didRepository.storeReceivedDid(agentContext, {
        did: didDocument.id,
        didDocument,
        tags: {
          alternativeDids: isValidPeerDid(didDocument.id) ? getAlternativeDidsForPeerDid(didDocument.id) : undefined,
        },
      })
    }

    const previousTheirDid = connection.theirDid ?? priorDid
    if (connection.theirDid && !connection.previousTheirDids.includes(connection.theirDid)) {
      connection.previousTheirDids = [...connection.previousTheirDids, connection.theirDid]
    } else if (!connection.previousTheirDids.includes(priorDid)) {
      connection.previousTheirDids = [...connection.previousTheirDids, priorDid]
    }
    connection.theirDid = newDid

    await agentContext.dependencyManager.resolve(DidCommConnectionService).update(agentContext, connection)
    this.emitDidRotatedEvent(agentContext, connection, { previousTheirDid })
  }

  /**
   * Mark a connection as terminated by the peer per DIDComm V2 rotate-to-nothing.
   *
   * @see https://identity.foundation/didcomm-messaging/spec/v2.1/#ending-a-relationship
   */
  public async processRotateToNothing(agentContext: AgentContext, connection: DidCommConnectionRecord) {
    if (connection.theirDid) {
      connection.previousTheirDids = [...connection.previousTheirDids, connection.theirDid]
    }
    const previousTheirDid = connection.theirDid
    connection.theirDid = undefined
    await agentContext.dependencyManager.resolve(DidCommConnectionService).update(agentContext, connection)
    this.emitDidRotatedEvent(agentContext, connection, { previousTheirDid })
  }

  /**
   * Send an empty DIDComm V2 message with a `from_prior` JWT (no `sub`) to signal
   * termination of the relationship to `connection.theirDid`.
   */
  public async sendRotateToNothing(agentContext: AgentContext, connection: DidCommConnectionRecord): Promise<void> {
    if (!connection.did || !connection.theirDid) {
      throw new CredoError(`Cannot send v2 termination signal: connection '${connection.id}' missing did or theirDid`)
    }

    const fromPriorJwt = await this.createFromPriorForTermination(agentContext, connection.did)

    const documentService = agentContext.dependencyManager.resolve(DidCommDocumentService)
    const services = await documentService.resolveServicesFromDid(agentContext, connection.theirDid)
    if (services.length === 0) {
      throw new CredoError(`No DIDComm service resolvable for '${connection.theirDid}'`)
    }
    const service = services[0]
    if (service.recipientKeys.length === 0) {
      throw new CredoError(`Resolved DIDComm service for '${connection.theirDid}' has no recipient key`)
    }

    const recipientEd25519 = service.recipientKeys[0]
    const recipientKeyAgreement = toKeyAgreement(recipientEd25519)
    recipientKeyAgreement.keyId = recipientEd25519.hasKeyId ? recipientEd25519.keyId : new DidKey(recipientEd25519).did

    const empty = new DidCommEmptyMessage({ fromPrior: fromPriorJwt })
    const plaintext: DidCommV2PlaintextMessage = {
      id: empty.id,
      type: DidCommEmptyMessage.type.messageTypeUri,
      to: [connection.theirDid],
      from_prior: fromPriorJwt,
      body: {},
    }

    const v2EnvelopeService = agentContext.dependencyManager.resolve(DidCommV2EnvelopeService)
    let payload = await v2EnvelopeService.packAnoncrypt(agentContext, plaintext, {
      recipientKey: recipientKeyAgreement,
    })

    if (service.routingKeys.length > 0) {
      const recipientNext = new DidKey(toKeyAgreement(recipientEd25519)).did
      const reversed = [...service.routingKeys].reverse()
      for (let i = 0; i < reversed.length; i++) {
        const routingKey = reversed[i]
        const next = i === reversed.length - 1 ? recipientNext : new DidKey(reversed[i + 1]).did
        const routingKeyAgreement = toKeyAgreement(routingKey)
        routingKeyAgreement.keyId = new DidKey(routingKey).did
        const forwardPlaintext = DidCommForwardV2Message.createV2PlaintextMessage({
          to: [new DidKey(routingKey).did],
          next,
          attachments: [
            {
              id: utils.uuid(),
              media_type: 'application/didcomm-encrypted+json',
              data: { json: payload as unknown as Record<string, unknown> },
            },
          ],
        })
        payload = await v2EnvelopeService.packAnoncrypt(agentContext, forwardPlaintext, {
          recipientKey: routingKeyAgreement,
        })
      }
    }

    const didCommModuleConfig = agentContext.dependencyManager.resolve(DidCommModuleConfig)
    const scheme = utils.getProtocolScheme(service.serviceEndpoint)
    if (!scheme) {
      throw new CredoError(`No protocol scheme on service endpoint '${service.serviceEndpoint}'`)
    }
    const transport = didCommModuleConfig.outboundTransports.find((t) => t.supportedSchemes.includes(scheme))
    if (!transport) {
      throw new CredoError(`No outbound transport supports scheme '${scheme}' for v2 termination`)
    }

    this.logger.debug('Sending empty message with from_prior (rotate-to-nothing)', {
      connectionId: connection.id,
      to: connection.theirDid,
      endpoint: service.serviceEndpoint,
      routingKeys: service.routingKeys.length,
    })

    await transport.sendMessage({
      payload,
      endpoint: service.serviceEndpoint,
      connectionId: connection.id,
    })

    const outboundContext = new DidCommOutboundMessageContext(empty, {
      agentContext,
      connection,
    })
    this.eventEmitter.emit<DidCommMessageSentEvent>(agentContext, {
      type: DidCommEventTypes.DidCommMessageSent,
      payload: { message: outboundContext, status: OutboundMessageSendStatus.SentToTransport },
    })
  }

  /**
   * Build a `from_prior` JWT for a regular DID rotation (sub set to the new DID).
   * Signed by an authentication key authorized by `priorDid` per
   * https://identity.foundation/didcomm-messaging/spec/v2.1/#did-rotation.
   */
  public async createFromPriorForRotation(
    agentContext: AgentContext,
    priorDid: string,
    newDid: string
  ): Promise<string> {
    return this.createFromPrior(agentContext, priorDid, newDid)
  }

  /**
   * Build a `from_prior` JWT that signals termination of the relationship.
   *
   * @see https://identity.foundation/didcomm-messaging/spec/v2.1/#ending-a-relationship
   * Payload contains `iss` (prior DID) and `iat`; `sub` is omitted to indicate
   * rotation to nothing. Signed by an authentication key authorized by `priorDid`.
   */
  public async createFromPriorForTermination(agentContext: AgentContext, priorDid: string): Promise<string> {
    return this.createFromPrior(agentContext, priorDid, undefined)
  }

  /**
   * Verify a `from_prior` JWT and return its parsed payload.
   *
   * The signing key MUST be authorized in the `authentication` relationship of
   * the `iss` DID document, per
   * https://identity.foundation/didcomm-messaging/spec/v2.1/#did-rotation
   */
  public async verifyFromPrior(agentContext: AgentContext, jws: string): Promise<FromPriorPayload> {
    const resolver = agentContext.dependencyManager.resolve(DidResolverService)
    const dids = agentContext.dependencyManager.resolve(DidsApi)

    const result = await this.jwsService.verifyJws(agentContext, {
      jws,
      allowedJwsSignerMethods: ['did'],
      resolveJwsSigner: async ({ payload, protectedHeader }) => {
        const claims = JsonEncoder.fromBase64Url(payload)
        if (typeof claims.iss !== 'string') {
          throw new CredoError("from_prior JWT payload missing or invalid 'iss'")
        }
        const kid = typeof protectedHeader.kid === 'string' ? protectedHeader.kid : undefined
        if (!kid) {
          throw new CredoError("from_prior JWT protected header missing 'kid'")
        }

        const didDocument = await this.resolveDidDocument(agentContext, claims.iss, dids, resolver)
        const vm = didDocument.dereferenceKey(kid, ['authentication'])
        const publicJwk = getPublicJwkFromVerificationMethod(vm)

        return { method: 'did', didUrl: kid, jwk: publicJwk }
      },
    })

    if (!result.isValid) throw new CredoError('from_prior JWT signature verification failed')

    const payloadJson = JsonEncoder.fromBase64Url(result.jws.payload) as Record<string, unknown>
    if (typeof payloadJson.iss !== 'string') throw new CredoError("from_prior JWT missing 'iss'")
    if (typeof payloadJson.iat !== 'number') throw new CredoError("from_prior JWT missing 'iat'")
    if (payloadJson.sub !== undefined && typeof payloadJson.sub !== 'string') {
      throw new CredoError("from_prior JWT 'sub' must be a string if present")
    }

    return {
      iss: payloadJson.iss,
      sub: payloadJson.sub as string | undefined,
      iat: payloadJson.iat,
    }
  }

  private async createFromPrior(
    agentContext: AgentContext,
    priorDid: string,
    newDid: string | undefined
  ): Promise<string> {
    const dids = agentContext.dependencyManager.resolve(DidsApi)
    const { didDocument, keys } = await dids.resolveCreatedDidDocumentWithKeys(priorDid)

    const authVm = this.findAuthenticationVerificationMethod(didDocument)
    const kmsKey = keys?.find(({ didDocumentRelativeKeyId }) => authVm.id.endsWith(didDocumentRelativeKeyId))
    if (!kmsKey) {
      throw new CredoError(`No KMS key for authentication verification method '${authVm.id}' of '${priorDid}'`)
    }

    const payload = new JwtPayload({
      iss: priorDid,
      sub: newDid,
      iat: Math.floor(Date.now() / 1000),
    })

    return this.jwsService.createJwsCompact(agentContext, {
      keyId: kmsKey.kmsKeyId,
      payload,
      protectedHeaderOptions: {
        alg: 'EdDSA',
        kid: authVm.id,
        typ: 'JWT',
        crv: 'Ed25519',
      },
    })
  }

  private findAuthenticationVerificationMethod(didDocument: DidDocument): VerificationMethod {
    if (!didDocument.authentication?.length) {
      throw new CredoError(`DID document '${didDocument.id}' has no authentication verification methods`)
    }
    const first = didDocument.authentication[0]
    return typeof first === 'string' ? didDocument.dereferenceKey(first, ['authentication']) : first
  }

  private async resolveDidDocument(
    agentContext: AgentContext,
    did: string,
    dids: DidsApi,
    resolver: DidResolverService
  ): Promise<DidDocument> {
    try {
      const { didDocument } = await dids.resolveCreatedDidDocumentWithKeys(did)
      return didDocument
    } catch {
      return resolver.resolveDidDocument(agentContext, did)
    }
  }

  private didsEqual(a: string, b: string): boolean {
    if (a === b) return true
    if (isValidPeerDid(a) && isValidPeerDid(b)) {
      const altA = getAlternativeDidsForPeerDid(a) ?? []
      if (altA.includes(b)) return true
      const altB = getAlternativeDidsForPeerDid(b) ?? []
      if (altB.includes(a)) return true
    }
    return false
  }

  private emitDidRotatedEvent(
    agentContext: AgentContext,
    connectionRecord: DidCommConnectionRecord,
    { previousTheirDid, previousOurDid }: { previousTheirDid?: string; previousOurDid?: string }
  ) {
    this.eventEmitter.emit<DidCommConnectionDidRotatedEvent>(agentContext, {
      type: DidCommConnectionEventTypes.DidCommConnectionDidRotated,
      payload: {
        connectionRecord: connectionRecord.clone(),
        ourDid: previousOurDid && connectionRecord.did ? { from: previousOurDid, to: connectionRecord.did } : undefined,
        theirDid:
          previousTheirDid && connectionRecord.theirDid
            ? { from: previousTheirDid, to: connectionRecord.theirDid }
            : undefined,
      },
    })
  }
}
