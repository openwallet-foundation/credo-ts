import type { KeyPair } from '../../../crypto'
import type { Buffer } from '../../../utils'
import type { VerificationMethod } from '../../dids'

import { Lifecycle, scoped } from 'tsyringe'

import { CryptoService, KeyFormat, KeyType } from '../../../crypto'
import { AriesFrameworkError } from '../../../error'
import { TypedArrayEncoder } from '../../../utils'
import { verificationKeyTypeToKeyTypeMapping } from '../../dids/domain/verificationMethod/VerificationMethod'
import { KeyRecord, KeyRepository } from '../repository'

@scoped(Lifecycle.ContainerScoped)
export class KeyService {
  private cryptoService: CryptoService
  private keyRepository: KeyRepository

  public constructor(cryptoService: CryptoService, ketRepository: KeyRepository) {
    this.cryptoService = cryptoService
    this.keyRepository = ketRepository
  }

  public async createKey(params: { keyType?: KeyType; seed?: string }): Promise<KeyPair> {
    return await this.cryptoService.createKey({
      keyType: params.keyType || KeyType.Ed25519,
      seed: params.seed,
    })
  }

  public async convertEd25519ToX25519Key(params: { keyPair: KeyPair }): Promise<KeyPair> {
    return await this.cryptoService.convertEd25519ToX25519Key(params.keyPair)
  }

  public async storeKey(params: {
    keyPair: KeyPair
    controller: string
    kid: string
    keyType?: KeyType
    keyFormat?: KeyFormat
  }): Promise<KeyRecord> {
    const type = params.keyType || KeyType.Ed25519
    const format = params.keyFormat || KeyFormat.Base58

    const { privateKey, publicKey } = KeyService.getKeysRepresentation(params.keyPair, format)

    const keyRecord = new KeyRecord({
      kid: params.kid,
      controller: params.controller,
      keyType: type,
      format,
      privateKey,
      publicKey,
    })

    await this.keyRepository.save(keyRecord)

    return keyRecord
  }

  public async deleteKey(kid: string): Promise<boolean> {
    const keyRecord = await this.keyRepository.findByKid(kid)
    if (keyRecord) {
      await this.keyRepository.delete(keyRecord)
      return true
    } else {
      return false
    }
  }

  public async sign(params: { payload: Buffer; kid: string }): Promise<Buffer> {
    const keyRecord: KeyRecord | null = await this.keyRepository.getByKid(params.kid)
    if (!keyRecord) {
      throw new AriesFrameworkError(`Unable to find sign key for did: ${params.kid}`)
    }
    return this.cryptoService.sign({
      payload: params.payload,
      verKey: keyRecord.publicKeyBytes,
      signKey: keyRecord.privateKeyBytes,
      keyType: keyRecord.keyType,
    })
  }

  public async verify(params: { payload: Buffer; signature: Buffer; key: VerificationMethod }): Promise<boolean> {
    return this.cryptoService.verify({
      payload: params.payload,
      signature: params.signature,
      key: params.key.keyBytes,
      keyType: verificationKeyTypeToKeyTypeMapping[params.key.type],
    })
  }

  public async encrypt(params: {
    payload: Buffer
    senderKid: string
    recipientKey: VerificationMethod
  }): Promise<Buffer> {
    const senderKeyRecord: KeyRecord | null = await this.keyRepository.getByKid(params.senderKid)
    if (!senderKeyRecord) {
      throw new AriesFrameworkError(`Unable to find sign key for did: ${params.senderKid}`)
    }
    return this.cryptoService.encrypt({
      payload: params.payload,
      senderPublicKey: senderKeyRecord.publicKeyBytes,
      senderPrivateKey: senderKeyRecord.privateKeyBytes,
      recipientPublicKey: params.recipientKey.keyBytes,
      keyType: senderKeyRecord.keyType,
    })
  }

  public async decrypt(params: {
    payload: Buffer
    senderKey: VerificationMethod
    recipientKid: string
  }): Promise<Buffer> {
    const recipientKeyRecord: KeyRecord | null = await this.keyRepository.getByKid(params.recipientKid)
    if (!recipientKeyRecord) {
      throw new AriesFrameworkError(`Unable to find sign key for did: ${params.recipientKid}`)
    }
    return this.cryptoService.decrypt({
      payload: params.payload,
      senderPublicKey: params.senderKey.keyBytes,
      recipientPublicKey: recipientKeyRecord.publicKeyBytes,
      recipientPrivateKey: recipientKeyRecord.privateKeyBytes,
      keyType: recipientKeyRecord.keyType,
    })
  }

  public randomBytes(size: number): Uint8Array {
    return this.cryptoService.randomBytes(size)
  }

  public update(keyRecord: KeyRecord): Promise<void> {
    return this.keyRepository.update(keyRecord)
  }
  public getAll() {
    return this.keyRepository.getAll()
  }

  public getAllByController(controller: string): Promise<KeyRecord[] | null> {
    return this.keyRepository.findByQuery({ controller })
  }

  public getById(kid: string): Promise<KeyRecord> {
    return this.keyRepository.getById(kid)
  }

  public getByKid(kid: string): Promise<KeyRecord | null> {
    return this.keyRepository.getByKid(kid)
  }

  public findByKid(kid: string): Promise<KeyRecord | null> {
    return this.keyRepository.findByKid(kid)
  }

  private static getKeysRepresentation(
    keyPair: KeyPair,
    keyRepresentationType: KeyFormat
  ): { publicKey: string; privateKey: string } {
    switch (keyRepresentationType) {
      case KeyFormat.Base58: {
        return {
          publicKey: TypedArrayEncoder.toBase58(keyPair.publicKey),
          privateKey: TypedArrayEncoder.toBase58(keyPair.privateKey),
        }
      }
      case KeyFormat.Base64: {
        return {
          publicKey: TypedArrayEncoder.toBase64(keyPair.publicKey),
          privateKey: TypedArrayEncoder.toBase64(keyPair.privateKey),
        }
      }
      default: {
        throw new AriesFrameworkError(`Key Representation format is not supported: ${keyRepresentationType}`)
      }
    }
  }
}
