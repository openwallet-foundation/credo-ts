import type { AgentContext } from '../../../agent'
import type { Key } from '../../../crypto'
import type { Logger } from '../../../logger'
import type { MediationRecord } from '../../routing/repository/MediationRecord'
import type { DidDocument } from '../domain'
import type { DidCreateResult } from '../types'

import { AgentConfig } from '../../../agent/AgentConfig'
import { InjectionSymbols } from '../../../constants'
import { KeyType } from '../../../crypto'
import { injectable, inject } from '../../../plugins'
import { uuid } from '../../../utils/uuid'
import { Wallet } from '../../../wallet/Wallet'
import { DidDocumentBuilder } from '../domain'
import { getEd25519VerificationMethod } from '../domain/key-type/ed25519'
import { getX25519VerificationMethod } from '../domain/key-type/x25519'
import { DidCommV2Service } from '../domain/service'
import { DidRegistrarService } from '../services/DidRegistrarService'

export interface DIDRoutingParams {
  endpoint?: string
  mediator?: MediationRecord
}

export interface CreateDIDParams {
  seed?: string
  method?: string
  routing?: DIDRoutingParams
}

export interface CreateDIDDocumentParams {
  authentications: Key[]
  keyAgreements: Key[]
  services: DidCommV2Service[]
}

@injectable()
export class DidService {
  private agentConfig: AgentConfig
  private logger: Logger
  private wallet: Wallet
  private didRegistrarService: DidRegistrarService

  public constructor(
    agentConfig: AgentConfig,
    @inject(InjectionSymbols.Wallet) wallet: Wallet,
    didRegistrarService: DidRegistrarService
  ) {
    this.logger = agentConfig.logger
    this.agentConfig = agentConfig
    this.wallet = wallet
    this.didRegistrarService = didRegistrarService
  }

  public async createDID(agentContext: AgentContext, params: CreateDIDParams = {}): Promise<DidCreateResult> {
    // Create keys
    const ed25519Key = await this.wallet.createKey({ seed: params.seed, keyType: KeyType.Ed25519 })
    const x25519Key = await this.wallet.createKey({ seed: params.seed, keyType: KeyType.X25519 })

    // Build services
    const services = await this.prepareDIDServices(params.routing)

    // Build DID Document
    const didDocument = await this.prepareDIDDocument({
      authentications: [ed25519Key],
      keyAgreements: [x25519Key],
      services,
    })

    // Register DID
    const result = await this.didRegistrarService.create(agentContext, {
      method: params.method,
      didDocument,
    })

    return result
  }

  private async prepareDIDServices({ endpoint, mediator }: DIDRoutingParams = {}): Promise<DidCommV2Service[]> {
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

  private async prepareDIDDocument({
    authentications,
    keyAgreements,
    services,
  }: CreateDIDDocumentParams): Promise<DidDocument> {
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
