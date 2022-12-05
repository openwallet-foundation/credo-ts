import type { AgentContext } from '../../../../agent'
import type { Key } from '../../../../crypto'
import type { ConnectionRecord } from '../../../connections/repository'
import type { DidDocument } from '../../../dids/domain'
import type { DidCreateResult } from '../../../dids/types'
import type { MediationRecord } from '../../../routing/repository/MediationRecord'

import { EventEmitter } from '../../../../agent/EventEmitter'
import { DID_COMM_TRANSPORT_QUEUE } from '../../../../constants'
import { KeyType } from '../../../../crypto'
import { injectable } from '../../../../plugins'
import { uuid } from '../../../../utils/uuid'
import { ConnectionService } from '../../../connections/services'
import { DidDocumentBuilder } from '../../../dids/domain'
import { getEd25519VerificationMethod } from '../../../dids/domain/key-type/ed25519'
import { getX25519VerificationMethod } from '../../../dids/domain/key-type/x25519'
import { DidCommV2Service } from '../../../dids/domain/service'
import { PeerDidNumAlgo } from '../../../dids/methods/peer'
import { DidRegistrarService } from '../../../dids/services'
import { V2MediationRecipientService } from '../../../routing/protocol/coordinate-mediation/v2/V2MediationRecipientService'

import { DidExchangeRole, DidExchangeState, HandshakeProtocol } from './../../../connections/models'
import { OutOfBandGoalCode, OutOfBandInvitation } from './messages'

export interface DidRoutingParams {
  endpoint?: string
  mediator?: MediationRecord
}

export interface CreateDidParams {
  seed?: string
  routing?: DidRoutingParams
}

interface BuildDidDocumentParams {
  authentications: Key[]
  keyAgreements: Key[]
  services: DidCommV2Service[]
}

@injectable()
export class V2OutOfBandService {
  private didRegistrarService: DidRegistrarService
  private mediationRecipientService: V2MediationRecipientService
  private connectionService: ConnectionService
  private eventEmitter: EventEmitter

  public constructor(
    didRegistrarService: DidRegistrarService,
    mediationRecipientService: V2MediationRecipientService,
    connectionService: ConnectionService,
    eventEmitter: EventEmitter
  ) {
    this.didRegistrarService = didRegistrarService
    this.mediationRecipientService = mediationRecipientService
    this.connectionService = connectionService
    this.eventEmitter = eventEmitter
  }

  public async createInvitation(agentContext: AgentContext): Promise<OutOfBandInvitation> {
    const didResult = await this.createDid(agentContext)
    return new OutOfBandInvitation({
      from: didResult.didState.did,
      body: {
        goalCode: OutOfBandGoalCode.DidExchange,
      },
    })
  }

  public async acceptInvitation(
    agentContext: AgentContext,
    invitation: OutOfBandInvitation
  ): Promise<{ connectionRecord: ConnectionRecord }> {
    const didResult = await this.createDid(agentContext)

    const connectionRecord = await this.connectionService.createConnection(agentContext, {
      protocol: HandshakeProtocol.V2DidExchange,
      role: DidExchangeRole.Responder,
      state: DidExchangeState.Completed,
      theirLabel: invitation.body.goal,
      outOfBandId: invitation.id,
      invitationDid: invitation.from,
      theirDid: invitation.from,
      did: didResult.didState.did,
    })
    return { connectionRecord }
  }

  private async createDid(agentContext: AgentContext, params: CreateDidParams = {}): Promise<DidCreateResult> {
    const mediationRecord = await this.mediationRecipientService.findDefaultMediator(agentContext)

    // Create keys
    const authentication = await agentContext.wallet.createKey({ seed: params.seed, keyType: KeyType.Ed25519 })
    const keyAgreement = await agentContext.wallet.createKey({ seed: params.seed, keyType: KeyType.X25519 })

    // Build services
    const services = this.prepareServices({
      endpoint: agentContext.config.endpoints[0],
      mediator: mediationRecord || undefined,
    })

    // Build DID Document
    const didDocument = this.buildDidDocument({
      authentications: [authentication],
      keyAgreements: [keyAgreement],
      services,
    })

    const didResult = await this.didRegistrarService.create(agentContext, {
      method: 'peer',
      didDocument,
      options: {
        numAlgo: PeerDidNumAlgo.MultipleInceptionKeyWithoutDoc,
      },
    })

    if (mediationRecord && didResult.didState.did) {
      await this.mediationRecipientService.didListUpdateAndAwait(agentContext, mediationRecord, didResult.didState.did)
    }

    return didResult
  }

  private prepareServices({ endpoint, mediator }: DidRoutingParams = {}): DidCommV2Service[] {
    const services: DidCommV2Service[] = []

    if (endpoint && endpoint !== DID_COMM_TRANSPORT_QUEUE) {
      services.push(
        new DidCommV2Service({
          id: `#${uuid()}`,
          serviceEndpoint: endpoint,
          routingKeys: [],
        })
      )
    }
    if (mediator?.endpoint) {
      services.push(
        new DidCommV2Service({
          id: `#${uuid()}`,
          serviceEndpoint: mediator.endpoint,
          routingKeys: mediator.routingKeys,
        })
      )
    }

    return services
  }

  private buildDidDocument({ authentications, keyAgreements, services }: BuildDidDocumentParams): DidDocument {
    const didDocumentBuilder = new DidDocumentBuilder('')

    authentications.forEach((authentication) =>
      didDocumentBuilder.addAuthentication(
        getEd25519VerificationMethod({
          id: `#${uuid()}`,
          key: authentication,
          controller: '#id',
        })
      )
    )
    keyAgreements.forEach((keyAgreement) =>
      didDocumentBuilder.addKeyAgreement(
        getX25519VerificationMethod({
          id: `#${uuid()}`,
          key: keyAgreement,
          controller: '#id',
        })
      )
    )
    services.forEach((service) => didDocumentBuilder.addService(service))

    return didDocumentBuilder.build()
  }
}
