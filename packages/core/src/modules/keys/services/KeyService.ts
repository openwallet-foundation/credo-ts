import type { KeyPair } from '../../../crypto'
import type { Logger } from '../../../logger'
import type { Buffer } from '../../../utils'
import type { VerificationMethod } from '../../dids'

import { inject, Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { InjectionSymbols } from '../../../constants'
import { Crypto, KeyFormat, KeyType } from '../../../crypto'
import { AriesFrameworkError } from '../../../error'
import { TypedArrayEncoder } from '../../../utils'
import { Key } from '../../dids/domain/Key'
import { verificationKeyTypeToKeyTypeMapping } from '../../dids/domain/verificationMethod/VerificationMethod'
import { KeyRecord, KeyRepository } from '../repository'

@scoped(Lifecycle.ContainerScoped)
export class KeyService {
  private logger: Logger
  private crypto: Crypto
  private keyRepository: KeyRepository

  public constructor(
    agentConfig: AgentConfig,
    @inject(InjectionSymbols.Crypto) crypto: Crypto,
    ketRepository: KeyRepository
  ) {
    this.logger = agentConfig.logger
    this.crypto = crypto
    this.keyRepository = ketRepository
  }

  public async createKey(params: {
    controller?: string
    kid?: string
    keyType?: KeyType
    keyFormat?: KeyFormat
    seed?: string
  }): Promise<KeyRecord> {
    const type = params.keyType || KeyType.Ed25519
    const format = params.keyFormat || KeyFormat.Base58
    const keyPair = await this.crypto.createKey({ keyType: type, seed: params.seed })

    const kid = params.kid
      ? params.kid
      : params.controller
      ? `${params.controller}#${Key.fromPublicKey(keyPair.publicKey, type).fingerprint}`
      : TypedArrayEncoder.toBase58(keyPair.publicKey)

    const { privateKey, publicKey } = KeyService.getKeysRepresentation(keyPair, format)

    const keyRecord = new KeyRecord({
      kid,
      controller: params.controller,
      keyType: type,
      format,
      privateKey,
      publicKey,
    })

    await this.keyRepository.save(keyRecord)

    return keyRecord
  }

  public async sign(params: { payload: Buffer; kid: string }): Promise<Buffer> {
    const keyRecord: KeyRecord | null = await this.keyRepository.getByKid(params.kid)
    if (!keyRecord) {
      throw new AriesFrameworkError(`Unable to find sign key for did: ${params.kid}`)
    }
    return this.crypto.sign({
      payload: params.payload,
      signKey: keyRecord.privateKeyBytes,
      keyType: keyRecord.keyType,
    })
  }

  public async verify(params: { payload: Buffer; signature: Buffer; key: VerificationMethod }): Promise<boolean> {
    return this.crypto.verify({
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
    return this.crypto.aesEncrypt({
      payload: params.payload,
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
    return this.crypto.aesDecrypt({
      payload: params.payload,
      senderPublicKey: params.senderKey.keyBytes,
      recipientPrivateKey: recipientKeyRecord.privateKeyBytes,
      keyType: recipientKeyRecord.keyType,
    })
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
  ): { publicKey: any; privateKey: any } {
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
