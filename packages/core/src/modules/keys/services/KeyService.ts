import type { Logger } from '../../../logger'
import type { Base58KeyRepresentation } from '../repository'

import { inject, Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { KeyManager } from '../../../key-manager'
import { KeyType } from '../../../key-manager/KeyManager'
import { TypedArrayEncoder } from '../../../utils'
import { KeyRecord, KeyRepository } from '../repository'

import { InjectionSymbols } from '@aries-framework/core'

@scoped(Lifecycle.ContainerScoped)
export class KeyService {
  private logger: Logger
  private keyManager: KeyManager
  private keyRepository: KeyRepository

  public constructor(
    agentConfig: AgentConfig,
    @inject(InjectionSymbols.KeyManager) keyManager: KeyManager,
    ketRepository: KeyRepository
  ) {
    this.logger = agentConfig.logger
    this.keyManager = keyManager
    this.keyRepository = ketRepository
  }

  public async createKey(controller: string, kid?: string, keyType?: KeyType): Promise<KeyRecord> {
    const type = keyType || KeyType.Ed25519
    const keyPair = await this.keyManager.createKey({ keyType: keyType })

    const privateKey: Base58KeyRepresentation = {
      Base58: TypedArrayEncoder.toBase58(keyPair.privateKey),
    }

    const publicKey: Base58KeyRepresentation = {
      Base58: TypedArrayEncoder.toBase58(keyPair.publicKey),
    }

    const keyRecord = new KeyRecord({
      kid: kid || publicKey.Base58,
      controller: controller,
      keyType: type,
      privateKey,
      publicKey,
    })

    await this.keyRepository.save(keyRecord)

    return keyRecord
  }

  public getAll() {
    return this.keyRepository.getAll()
  }

  public getAllByController(controller: string): Promise<KeyRecord[] | null> {
    return this.keyRepository.findByQuery({ controller })
  }

  public getAllByKeyType(keyType: KeyType): Promise<KeyRecord[] | null> {
    return this.keyRepository.findByQuery({ keyType })
  }

  public getById(kid: string): Promise<KeyRecord> {
    return this.keyRepository.getById(kid)
  }

  public findByKid(kid: string): Promise<KeyRecord | null> {
    return this.keyRepository.getById(kid)
  }
}
