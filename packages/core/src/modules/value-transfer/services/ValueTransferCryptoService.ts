import type { Buffer } from '../../../utils'
import type { VtpCryptoInterface } from '@sicpa-dlab/value-transfer-protocol-ts'

import { KeyType } from '../../../crypto'
import { injectable } from '../../../plugins'
import { Key } from '../../dids'
import { getEd25519VerificationMethod } from '../../dids/domain/key-type/ed25519'
import { DidService } from '../../dids/services/DidService'
import { KeyService } from '../../keys'

@injectable()
export class ValueTransferCryptoService implements VtpCryptoInterface {
  private didService: DidService
  private keysService: KeyService

  public constructor(didService: DidService, keysService: KeyService) {
    this.didService = didService
    this.keysService = keysService
  }

  public async signByDid(payload: Buffer, did: string): Promise<Buffer> {
    const didDoc = await this.didService.getDIDDoc(did)
    const kid = didDoc.verificationKeyId || didDoc.authenticationKeyId
    if (!kid) {
      throw new Error(`Unable to locate signing key for DID '${did}'`)
    }
    return await this.keysService.sign({ payload, kid })
  }

  public async verifyByDid(payload: Buffer, signature: Buffer, did: string): Promise<boolean> {
    const didDoc = await this.didService.getDIDDoc(did)
    const key = didDoc.getVerificationMethod() || didDoc.getAuthentication()
    if (!key) {
      throw new Error(`Unable to locate verification key for DID '${did}'`)
    }
    return this.keysService.verify({ payload, signature, key })
  }

  public async createKey(): Promise<string> {
    const keyType = KeyType.Ed25519
    const keyPair = await this.keysService.createKey({ keyType })
    const key = Key.fromPublicKey(keyPair.publicKey, keyType)

    await this.keysService.storeKey({
      keyPair: keyPair,
      controller: '',
      kid: key.publicKeyBase58,
      keyType: key.keyType,
    })

    return key.publicKeyBase58
  }

  public async deleteKey(pubKey: string): Promise<boolean> {
    return this.keysService.deleteKey(pubKey)
  }

  public async signByKey(payload: Buffer, pubKey: string): Promise<Buffer> {
    return await this.keysService.sign({ payload, kid: pubKey })
  }

  public async verifyByKey(payload: Buffer, signature: Buffer, pubKey: string): Promise<boolean> {
    const key = getEd25519VerificationMethod({
      id: pubKey,
      key: Key.fromPublicKeyBase58(pubKey, KeyType.Ed25519),
      controller: '',
    })
    return this.keysService.verify({ payload, signature, key })
  }

  public randomBytes(size: number): Uint8Array {
    return this.keysService.randomBytes(size)
  }

  public async createDid(): Promise<string> {
    const didRecord = await this.didService.createDID()
    return didRecord.did
  }

  public async isDidExists(did: string): Promise<boolean> {
    const foundDid = await this.didService.findById(did)
    return !!foundDid
  }
}
