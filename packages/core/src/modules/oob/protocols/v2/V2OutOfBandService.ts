import type { AgentContext } from '../../../../agent'
import type { Key } from '../../../../crypto'
import type { ConnectionRecord } from '../../../connections/repository'
import type { DidDocument } from '../../../dids/domain'
import type { DidCreateResult } from '../../../dids/types'
import type { MediationRecord } from '../../../routing/repository/MediationRecord'

import { EventEmitter } from '../../../../agent/EventEmitter'
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
  private connectionService: ConnectionService
  private eventEmitter: EventEmitter

  public constructor(
    didRegistrarService: DidRegistrarService,
    connectionService: ConnectionService,
    eventEmitter: EventEmitter
  ) {
    this.didRegistrarService = didRegistrarService
    this.connectionService = connectionService
    this.eventEmitter = eventEmitter
  }

  public async createInvitation(agentContext: AgentContext): Promise<OutOfBandInvitation> {
    const didResult = await this.createDid(agentContext, {
      routing: { endpoint: agentContext.config.endpoints[0], mediator: undefined },
    })
    const invitation = new OutOfBandInvitation({
      from: didResult.didState.did,
      body: {
        goalCode: OutOfBandGoalCode.DidExchange,
      },
    })
    return invitation
  }

  public async acceptInvitation(
    agentContext: AgentContext,
    invitation: OutOfBandInvitation
  ): Promise<{ connectionRecord: ConnectionRecord }> {
    const didResult = await this.createDid(agentContext, {
      routing: { endpoint: agentContext.config.endpoints[0], mediator: undefined },
    })
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
    // Create keys
    const authentication = await agentContext.wallet.createKey({ keyType: KeyType.Ed25519 })
    const keyAgreement = await agentContext.wallet.createKey({ keyType: KeyType.X25519 })

    // Build services
    const services = this.prepareServices(params.routing)

    // Build DID Document
    const didDocument = this.buildDidDocument({
      authentications: [authentication],
      keyAgreements: [keyAgreement],
      services,
    })

    return this.didRegistrarService.create(agentContext, {
      method: 'peer',
      didDocument,
      options: {
        numAlgo: PeerDidNumAlgo.MultipleInceptionKeyWithoutDoc,
      },
    })
  }

  private prepareServices({ endpoint, mediator }: DidRoutingParams = {}): DidCommV2Service[] {
    const services: DidCommV2Service[] = []

    if (endpoint) {
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
