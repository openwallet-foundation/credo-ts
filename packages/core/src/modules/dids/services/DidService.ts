import type { Logger } from '../../../logger'
import type { DidDocument, VerificationMethod } from '../domain'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { defaultKeyType, KeyType } from '../../../crypto'
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

    // FIXME: We need properly generate keys
    // `.didDocument` method creates x25519 key from the ed25519
    // x25519 also need to be stored in the wallet
    //drop the workaround below
    const keyRecord = await this.keysService.createKey({ keyType: KeyType.Ed25519, seed })
    const keyRecord2 = await this.keysService.createKey({ keyType: KeyType.X25519, seed })

    let did: string
    let didDocument: DidDocument

    const key = Key.fromPublicKey(keyRecord.publicKeyBytes, keyRecord.keyType)
    const key2 = Key.fromPublicKey(keyRecord2.publicKeyBytes, keyRecord2.keyType)

    switch (type) {
      case DidType.KeyDid: {
        const didKey = new DidKey(key)
        did = didKey.did
        didDocument = didKey.didDocument
        break
      }
      case DidType.PeerDid: {
        const didKey = DidPeer.fromKey(key)
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

    keyRecord.kid = `${did}#${key.fingerprint}`
    keyRecord.controller = did
    await this.keysService.update(keyRecord)

    keyRecord2.kid = `${did}#${key2.fingerprint}`
    keyRecord2.controller = did
    await this.keysService.update(keyRecord2)

    await this.keysService.getByKid(keyRecord.kid)
    await this.keysService.getByKid(keyRecord2.kid)

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
