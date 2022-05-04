import type { AesEncryptParams, CreateKeyParams, Crypto, SignParams, VerifyParams, AesDecryptParams } from './Crypto'
import type { KeyPair } from './types'

import * as aes from '@stablelib/aes'
import * as ed25519 from '@stablelib/ed25519'
import * as x25518 from '@stablelib/x25519'
import { Lifecycle, scoped } from 'tsyringe'

import { AriesFrameworkError } from '../error'
import { Buffer } from '../utils'

import { defaultKeyType, KeyType } from './types'

@scoped(Lifecycle.ContainerScoped)
export class StablelibCrypto implements Crypto {
  public async createKey(params: CreateKeyParams): Promise<KeyPair> {
    const keyType = params.keyType || defaultKeyType
    switch (keyType) {
      case KeyType.Ed25519: {
        return this.createEd25519Key(params.seed)
      }
      case KeyType.X25519: {
        return this.createX25519Key(params.seed)
      }
      default:
        throw new AriesFrameworkError(`Key type is not supported: ${keyType}`)
    }
  }

  public async sign(params: SignParams): Promise<Buffer> {
    const keyType = params.keyType || defaultKeyType
    switch (keyType) {
      case KeyType.Ed25519: {
        const signature = await ed25519.sign(params.payload, params.signKey)
        return Buffer.from(signature)
      }
      default:
        throw new AriesFrameworkError(`Unsupported key type: ${keyType}`)
    }
  }

  public async verify(params: VerifyParams): Promise<boolean> {
    const keyType = params.keyType || defaultKeyType
    switch (keyType) {
      case KeyType.Ed25519: {
        return ed25519.verify(params.signature, params.payload, params.key)
      }
      default:
        throw new AriesFrameworkError(`Unsupported key type: ${keyType}`)
    }
  }

  public async aesEncrypt(params: AesEncryptParams): Promise<Buffer> {
    const keyType = params.keyType || defaultKeyType
    switch (keyType) {
      case KeyType.Ed25519: {
        const shared = x25518.sharedKey(
          ed25519.convertSecretKeyToX25519(params.senderPrivateKey),
          ed25519.convertPublicKeyToX25519(params.recipientPublicKey)
        )
        const encrypted: Uint8Array = new Uint8Array([])
        new aes.AES(shared).encryptBlock(params.payload, encrypted)
        return Buffer.from(encrypted)
      }
      case KeyType.X25519: {
        const shared = x25518.sharedKey(params.senderPrivateKey, params.recipientPublicKey)
        const encrypted: Uint8Array = new Uint8Array([])
        new aes.AES(shared).encryptBlock(params.payload, encrypted)
        return Buffer.from(encrypted)
      }
      default:
        throw new AriesFrameworkError(`Unsupported key type: ${keyType}`)
    }
  }

  public async aesDecrypt(params: AesDecryptParams): Promise<Buffer> {
    const keyType = params.keyType || defaultKeyType
    switch (keyType) {
      case KeyType.Ed25519: {
        const shared = x25518.sharedKey(
          ed25519.convertSecretKeyToX25519(params.recipientPrivateKey),
          ed25519.convertPublicKeyToX25519(params.senderPublicKey)
        )
        const encrypted: Uint8Array = new Uint8Array([])
        new aes.AES(shared).encryptBlock(params.payload, encrypted)
        return Buffer.from(encrypted)
      }
      case KeyType.X25519: {
        const shared = x25518.sharedKey(params.recipientPrivateKey, params.senderPublicKey)
        const encrypted: Uint8Array = new Uint8Array([])
        new aes.AES(shared).encryptBlock(params.payload, encrypted)
        return Buffer.from(encrypted)
      }
      default:
        throw new AriesFrameworkError(`Unsupported key type: ${keyType}`)
    }
  }

  private async createEd25519Key(seed?: string): Promise<KeyPair> {
    const keyPair = seed ? ed25519.generateKeyPairFromSeed(new Buffer(seed)) : ed25519.generateKeyPair()
    return {
      privateKey: keyPair.secretKey,
      publicKey: keyPair.publicKey,
    }
  }

  private async createX25519Key(seed?: string): Promise<KeyPair> {
    const keyPair = await this.createEd25519Key(seed)
    return {
      privateKey: ed25519.convertSecretKeyToX25519(keyPair.privateKey),
      publicKey: ed25519.convertPublicKeyToX25519(keyPair.publicKey),
    }
  }
}
