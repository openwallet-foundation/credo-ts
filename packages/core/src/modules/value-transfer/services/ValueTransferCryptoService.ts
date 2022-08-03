import type { Buffer } from '../../../utils'
import type { CryptoInterface } from '@sicpa-dlab/value-transfer-protocol-ts'

import { Lifecycle, scoped } from 'tsyringe'

import { KeyType } from '../../../crypto'
import { Key } from '../../dids'
import { getEd25519VerificationMethod } from '../../dids/domain/key-type/ed25519'
import { DidService } from '../../dids/services/DidService'
import { KeyService } from '../../keys'

@scoped(Lifecycle.ContainerScoped)
export class ValueTransferCryptoService implements CryptoInterface {
  private didService: DidService
  private keysService: KeyService

  public constructor(didService: DidService, keysService: KeyService) {
    this.didService = didService
    this.keysService = keysService
  }

  public async signByDid(payload: Buffer, did: string): Promise<Buffer> {
    const kid = (await this.didService.getDIDDoc(did)).verificationKeyId
    return await this.keysService.sign({ payload, kid })
  }

  public async verifyByDid(payload: Buffer, signature: Buffer, did: string): Promise<boolean> {
    const key = (await this.didService.getDIDDoc(did)).getVerificationMethod()
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

  public async encrypt(payload: Buffer, senderDID: string, recipientDID: string): Promise<Buffer> {
    const senderKid = (await this.didService.getDIDDoc(senderDID)).agreementKeyId
    const recipientKey = (await this.didService.getDIDDoc(recipientDID)).getKeyAgreement()
    return this.keysService.encrypt({ payload, senderKid, recipientKey })
  }

  public async decrypt(payload: Buffer, senderDID: string, recipientDID: string): Promise<Buffer> {
    const recipientKid = (await this.didService.getDIDDoc(recipientDID)).agreementKeyId
    const senderKey = (await this.didService.getDIDDoc(senderDID)).getKeyAgreement()
    return this.keysService.decrypt({ payload, senderKey, recipientKid })
  }
}
