import type { CreateKeyParams, KeyManager, KeyPair } from './KeyManager'

import * as ed from '@noble/ed25519'
import * as secp from '@noble/secp256k1'
import { Lifecycle, scoped } from 'tsyringe'

import { AriesFrameworkError } from '../error'

import { KeyType } from './KeyManager'

@scoped(Lifecycle.ContainerScoped)
export class NobleKeyManager implements KeyManager {
  public async createKey(params: CreateKeyParams): Promise<KeyPair> {
    const keyType = params.keyType || KeyType.Ed25519
    switch (keyType) {
      case KeyType.Ed25519: {
        return await this.createEd25519Key()
      }
      case KeyType.X25519: {
        return await this.createX25519Key()
      }
      case KeyType.Secp256k1: {
        return await this.createSecp256k1Key()
      }
      default:
        throw new AriesFrameworkError(`Unsupported key type: ${params.keyType}`)
    }
  }

  private async createEd25519Key(): Promise<KeyPair> {
    const privateKey = ed.utils.randomPrivateKey()
    const publicKey = await ed.getPublicKey(privateKey)
    return { privateKey, publicKey }
  }

  private async createSecp256k1Key(): Promise<KeyPair> {
    const privateKey = secp.utils.randomPrivateKey()
    const publicKey = await secp.getPublicKey(privateKey)
    return { privateKey, publicKey }
  }

  private async createX25519Key(): Promise<KeyPair> {
    const privateKey = ed.utils.randomPrivateKey()
    const publicKey = ed.curve25519.scalarMultBase(privateKey)
    return { privateKey, publicKey }
  }
}
