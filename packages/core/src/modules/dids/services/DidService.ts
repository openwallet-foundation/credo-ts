import type { Logger } from '../../../logger'
import type { DidInfo } from '../../well-known'
import type { DidMetadataChangedEvent, DidReceivedEvent } from '../DidEvents'
import type { DidDocument } from '../domain'
import type { DidTags } from '../repository'
import type { DIDMetadata } from '../types'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { KeyType } from '../../../crypto'
import { AriesFrameworkError } from '../../../error'
import { KeyService } from '../../keys'
import { MediationRecipientService } from '../../routing/services'
import { hasOnlineTransport, Transports } from '../../routing/types'
import { DidEventTypes } from '../DidEvents'
import { DidCommV2Service, DidDocumentBuilder, DidType, Key } from '../domain'
import { DidDocumentRole } from '../domain/DidDocumentRole'
import { getEd25519VerificationMethod } from '../domain/key-type/ed25519'
import { getX25519VerificationMethod } from '../domain/key-type/x25519'
import { DidPeer, PeerDidNumAlgo } from '../methods/peer/DidPeer'
import { DidRecord, DidRepository } from '../repository'

import { DidResolverService } from './DidResolverService'

@scoped(Lifecycle.ContainerScoped)
export class DidService {
  private agentConfig: AgentConfig
  private logger: Logger
  private keysService: KeyService
  private didRepository: DidRepository
  private didResolverService: DidResolverService
  private mediationRecipientService: MediationRecipientService
  private eventEmitter: EventEmitter

  public constructor(
    agentConfig: AgentConfig,
    keysService: KeyService,
    didRepository: DidRepository,
    didResolverService: DidResolverService,
    mediationRecipientService: MediationRecipientService,
    eventEmitter: EventEmitter
  ) {
    this.logger = agentConfig.logger
    this.agentConfig = agentConfig
    this.keysService = keysService
    this.didRepository = didRepository
    this.didResolverService = didResolverService
    this.mediationRecipientService = mediationRecipientService
    this.eventEmitter = eventEmitter
  }

  public async createDID(
    params: {
      didType?: DidType
      keyType?: KeyType
      seed?: string
      isPublic?: boolean
      requestMediation?: boolean
      transports?: Transports[]
    } = {}
  ): Promise<DidRecord> {
    const didType_ = params.didType || DidType.PeerDid
    const keyType_ = params.keyType || KeyType.Ed25519

    const transports = params.transports || this.agentConfig.transports || []

    this.logger.debug(`creating DID with type ${didType_}`)

    const ed25519KeyPair = await this.keysService.createKey({ keyType: keyType_, seed: params.seed })
    const ed25519Key = Key.fromPublicKey(ed25519KeyPair.publicKey, keyType_)

    const x25519KeyPair = await this.keysService.convertEd25519ToX25519Key({ keyPair: ed25519KeyPair })
    const x25519Key = Key.fromPublicKey(x25519KeyPair.publicKey, KeyType.X25519)

    const didDocumentBuilder = new DidDocumentBuilder('')
      .addEd25519Context()
      .addX25519Context()
      .addAuthentication(getEd25519VerificationMethod({ controller: '', id: '', key: ed25519Key }))
      .addKeyAgreement(getX25519VerificationMethod({ controller: '', id: '', key: x25519Key }))

    if (hasOnlineTransport(transports)) {
      const mediator = await this.mediationRecipientService.findDefaultMediator()
      if (!mediator || !mediator.endpoint) {
        throw new Error('HTTP transport cannot be used because there is no connected Mediator')
      }
      didDocumentBuilder.addService(
        new DidCommV2Service({
          id: Transports.HTTP,
          serviceEndpoint: mediator.endpoint,
          routingKeys: mediator.routingKeys,
        })
      )
    }
    if (transports.includes(Transports.NFC)) {
      didDocumentBuilder.addService(new DidCommV2Service({ id: Transports.NFC, serviceEndpoint: Transports.NFC }))
    }
    if (transports.includes(Transports.IPC)) {
      didDocumentBuilder.addService(new DidCommV2Service({ id: Transports.IPC, serviceEndpoint: Transports.IPC }))
    }
    if (transports.includes(Transports.Nearby)) {
      didDocumentBuilder.addService(new DidCommV2Service({ id: Transports.Nearby, serviceEndpoint: Transports.Nearby }))
    }

    const didDocument = didDocumentBuilder.build()
    const didPeer =
      didDocument.service.length > 0
        ? DidPeer.fromDidDocument(didDocument, PeerDidNumAlgo.MultipleInceptionKeyWithoutDoc)
        : DidPeer.fromKey(ed25519Key)

    await this.keysService.storeKey({
      keyPair: ed25519KeyPair,
      controller: didPeer.did,
      kid: ed25519Key.buildKeyId(didPeer.did),
      keyType: keyType_,
    })

    const x25519KeyRecord = await this.keysService.storeKey({
      keyPair: x25519KeyPair,
      controller: didPeer.did,
      kid: x25519Key.buildKeyId(didPeer.did),
      keyType: KeyType.X25519,
    })

    if (hasOnlineTransport(transports) && (params.requestMediation || params.requestMediation === undefined)) {
      await this.mediationRecipientService.getRouting(x25519KeyRecord.kid, { useDefaultMediator: true })
    }

    const didRecord = new DidRecord({
      id: didPeer.did,
      didDocument: didPeer.didDocument,
      role: DidDocumentRole.Created,
      isPublic: params.isPublic,
    })

    await this.didRepository.save(didRecord)

    return didRecord
  }

  public async getPublicOrCrateNewDid(type: DidType, usePublicDid = false) {
    if (usePublicDid) {
      const publicDid = await this.findPublicDid()
      if (publicDid) return publicDid
    }
    return this.createDID({ didType: type })
  }

  public async getDIDDoc(did: string): Promise<DidDocument> {
    // resolve according to DID type
    const didDoc = await this.didResolverService.resolve(did)
    if (!didDoc.didDocument) {
      throw new AriesFrameworkError(`Unable to get DIDDoc for did: ${did}`)
    }
    return didDoc.didDocument
  }

  public async storeRemoteDid({ did, label, logoUrl }: DidInfo) {
    const didDocument = await this.didResolverService.resolve(did)
    if (!didDocument.didDocument) {
      throw new AriesFrameworkError(`Unable to resolve DidDoc for the DID: ${did}`)
    }

    const didRecord = new DidRecord({
      id: didDocument.didDocument.id,
      label: label,
      logoUrl: logoUrl,
      didDocument: didDocument.didDocument,
      role: DidDocumentRole.Received,
    })

    await this.didRepository.save(didRecord)
    this.eventEmitter.emit<DidReceivedEvent>({
      type: DidEventTypes.DidReceived,
      payload: { record: didRecord },
    })
  }

  public async setDidMetadata(record: DidRecord, meta: DIDMetadata) {
    record.label = meta.label
    record.logoUrl = meta.logoUrl
    await this.didRepository.update(record)
    this.eventEmitter.emit<DidMetadataChangedEvent>({
      type: DidEventTypes.DidMetadataChanged,
      payload: { record: record },
    })
  }

  public async getAll(): Promise<DidRecord[]> {
    return this.didRepository.getAll()
  }

  public async getMyDIDs() {
    return this.didRepository.findByQuery({
      role: DidDocumentRole.Created,
    })
  }

  public async getReceivedDIDs() {
    return this.didRepository.findByQuery({
      role: DidDocumentRole.Received,
    })
  }

  public async findAllByQuery(query: Partial<DidTags>) {
    return this.didRepository.findByQuery(query)
  }

  public getById(recordId: string): Promise<DidRecord> {
    return this.didRepository.getById(recordId)
  }

  public findById(recordId: string): Promise<DidRecord | null> {
    return this.didRepository.findById(recordId)
  }

  public async findPublicDid() {
    return this.didRepository.findSingleByQuery({
      isPublic: true,
    })
  }
}
