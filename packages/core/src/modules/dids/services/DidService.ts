import type { Logger } from '../../../logger'
import type { DidInfo } from '../../well-known'
import type { DidReceivedEvent, DidMetadataChangedEvent } from '../DidEvents'
import type { DidDocument } from '../domain'
import type { DidTags } from '../repository'
import type { DIDMetadata } from '../types'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { KeyType } from '../../../crypto'
import { AriesFrameworkError } from '../../../error'
import { KeyService } from '../../keys'
import { DidEventTypes } from '../DidEvents'
import { DidType, Key } from '../domain'
import { DidDocumentRole } from '../domain/DidDocumentRole'
import { DidKey } from '../methods/key'
import { DidPeer } from '../methods/peer/DidPeer'
import { DidRecord, DidRepository } from '../repository'

import { DidResolverService } from './DidResolverService'

@scoped(Lifecycle.ContainerScoped)
export class DidService {
  private logger: Logger
  private keysService: KeyService
  private didRepository: DidRepository
  private didResolverService: DidResolverService
  private eventEmitter: EventEmitter

  public constructor(
    agentConfig: AgentConfig,
    keysService: KeyService,
    didRepository: DidRepository,
    didResolverService: DidResolverService,
    eventEmitter: EventEmitter
  ) {
    this.logger = agentConfig.logger
    this.keysService = keysService
    this.didRepository = didRepository
    this.didResolverService = didResolverService
    this.eventEmitter = eventEmitter
  }

  public async createDID(didType?: DidType, keyType?: KeyType, seed?: string, isPublic?: boolean): Promise<DidRecord> {
    const didType_ = didType || DidType.KeyDid
    const keyType_ = keyType || KeyType.Ed25519

    this.logger.debug(`creating DID with type ${didType_}`)

    const keyPair = await this.keysService.createKey({ keyType: keyType_, seed })
    const key = Key.fromPublicKey(keyPair.publicKey, keyType_)

    const didDocument = this.getDIDDocumentFromKey(didType_, key)
    const did = didDocument.id

    const didRecord = new DidRecord({
      id: didDocument.id,
      didDocument,
      role: DidDocumentRole.Created,
      isPublic,
    })
    await this.didRepository.save(didRecord)

    // store key into wallet
    await this.keysService.storeKey({
      keyPair: keyPair,
      controller: did,
      kid: key.buildKeyId(did),
      keyType: keyType_,
    })

    // For keys of Ed25519
    // Ed25519 keys are used for messages signing only. When we use `pack/unpack` we use X25519
    // `.didDocument` method does conversion internally and appends x25519 into the DIDDoc
    // So we need to store x25519 in the wallet as well
    // TODO: Think of better way to do it
    if (keyType_ === KeyType.Ed25519) {
      const x25519KeyPair = await this.keysService.convertEd25519ToX25519Key({ keyPair: keyPair })
      const x25519Key = Key.fromPublicKey(x25519KeyPair.publicKey, KeyType.X25519)
      await this.keysService.storeKey({
        keyPair: x25519KeyPair,
        controller: did,
        kid: x25519Key.buildKeyId(did),
        keyType: KeyType.X25519,
      })
    }

    return didRecord
  }

  public async getPublicOrCrateNewDid(type: DidType, usePublicDid = false) {
    if (usePublicDid) {
      const publicDid = await this.findPublicDid()
      if (publicDid) return publicDid
    }
    return this.createDID(type)
  }

  public async getDIDDoc(did: string): Promise<DidDocument> {
    // find in the Wallet
    const didRecord = await this.didRepository.findById(did)
    if (didRecord?.didDocument) {
      return didRecord?.didDocument
    }
    // resolve according to DID type
    const didDoc = await this.didResolverService.resolve(did)
    if (!didDoc.didDocument) {
      throw new AriesFrameworkError(`Unable to get DIDDoc for did: ${did}`)
    }
    return didDoc.didDocument
  }

  private getDIDDocumentFromKey(didType: DidType, key: Key) {
    switch (didType) {
      case DidType.KeyDid: {
        return new DidKey(key).didDocument
      }
      case DidType.PeerDid: {
        return DidPeer.fromKey(key).didDocument
      }
      case DidType.Indy:
      case DidType.WebDid: {
        throw new AriesFrameworkError(`DID type(s) are not implemented: ${didType}`)
      }
    }
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
