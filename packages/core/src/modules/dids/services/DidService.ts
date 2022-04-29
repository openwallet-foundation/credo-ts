import type { KeyType } from '../../../crypto'
import type { Logger } from '../../../logger'
import type { DidDocument, VerificationMethod } from '../domain'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { defaultKeyType } from '../../../crypto'
import { AriesFrameworkError } from '../../../error'
import { KeyService } from '../../keys'
import { DidType, Key } from '../domain'
import { DidDocumentRole } from '../domain/DidDocumentRole'
import { keyTypeToVerificationKeyTypeMapping } from '../domain/verificationMethod/VerificationMethod'
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

  public constructor(
    agentConfig: AgentConfig,
    keysService: KeyService,
    didRepository: DidRepository,
    didResolverService: DidResolverService
  ) {
    this.logger = agentConfig.logger
    this.keysService = keysService
    this.didRepository = didRepository
    this.didResolverService = didResolverService
  }

  public async createDID(didType?: DidType, keyType?: KeyType, seed?: string): Promise<DidRecord> {
    const type = didType || DidType.KeyDid
    this.logger.debug(`creating DID with type ${type}`)

    const keyRecord = await this.keysService.createKey({ keyType, seed })

    let did: string
    let didDocument: DidDocument

    switch (type) {
      case DidType.KeyDid: {
        const didKey = new DidKey(Key.fromPublicKey(keyRecord.publicKeyBytes, keyRecord.keyType))
        did = didKey.did
        didDocument = didKey.didDocument
        break
      }
      case DidType.PeerDid: {
        const didKey = DidPeer.fromKey(Key.fromPublicKey(keyRecord.publicKeyBytes, keyRecord.keyType))
        did = didKey.did
        didDocument = didKey.didDocument
        break
      }
      case DidType.Indy:
      case DidType.WebDid: {
        throw new AriesFrameworkError(`DID type(s) are not implemented: ${type}`)
      }
    }

    const didRecord = new DidRecord({
      didDocument,
      id: did,
      role: DidDocumentRole.Created,
    })
    await this.didRepository.save(didRecord)

    keyRecord.controller = did
    await this.keysService.update(keyRecord)

    return didRecord
  }

  public async resolveLocalKey(did: string, keyType?: KeyType): Promise<string> {
    // TODO: implement proper steps of selecting a key to use
    const didRecord = await this.didRepository.getById(did)
    if (!didRecord.didDocument) {
      throw new AriesFrameworkError(`Unable to get DIDDoc for did: ${did}`)
    }
    return this.getVerificationMethod(didRecord.didDocument, keyType).id
  }

  public async resolveRemoteKey(did: string, keyType?: KeyType): Promise<VerificationMethod> {
    // TODO: implement proper steps of selecting a key to use
    const didDoc = await this.didResolverService.resolve(did)
    if (!didDoc.didDocument) {
      throw new AriesFrameworkError(`Unable to get DIDDoc for did: ${did}`)
    }
    return this.getVerificationMethod(didDoc.didDocument, keyType)
  }

  private getVerificationMethod(didDocument: DidDocument, keyType?: KeyType): VerificationMethod {
    const verificationKeyType = keyTypeToVerificationKeyTypeMapping[keyType || defaultKeyType]
    const verificationMethod = didDocument?.verificationMethod.find(
      (verificationMethod) => verificationMethod.type === verificationKeyType
    )
    if (!verificationMethod) {
      throw new AriesFrameworkError(`Unable to find verification method with required key type: ${keyType}`)
    }
    return verificationMethod
  }

  public getById(recordId: string): Promise<DidRecord> {
    return this.didRepository.getById(recordId)
  }

  public findById(recordId: string): Promise<DidRecord | null> {
    return this.didRepository.findById(recordId)
  }
}
