import type { KeyType } from '.'
import type { Wallet } from '..'
import type { Buffer } from '../utils/buffer'
import type { Key } from './Key'
import type { KeyPairReworkOptions } from './KeyPair'

import { AriesFrameworkError } from '..'
import { VerificationMethod } from '../modules/dids'
import { getKeyDidMappingByVerificationMethod } from '../modules/dids/domain/key-type/keyDidMapping'
import { JsonTransformer } from '../utils'
import { MessageValidator } from '../utils/MessageValidator'

import { KeyPair, KeyPairRework } from './KeyPair'

// export class WalletKeyPair extends KeyPair {
//   private wallet: Wallet
//   private keyType: KeyType
//   private key?: Key

//   public constructor(wallet: Wallet, keyType: KeyType, publicKeyBase58?: string) {
//     super()
//     this.wallet = wallet
//     this.keyType = keyType
//     if (publicKeyBase58) {
//       this.key = Key.fromPublicKeyBase58(publicKeyBase58, keyType)
//     }
//   }

//   public async sign(message: Buffer): Promise<Buffer> {
//     if (!this.key) {
//       throw new AriesFrameworkError('Unable to sign message with WalletKey: No key to sign with')
//     }

//     return await this.wallet.sign(message, this.key.publicKeyBase58)
//   }
//   public async verify(message: Buffer, signature: Buffer): Promise<boolean> {
//     if (!this.key) {
//       throw new AriesFrameworkError('Unable to verify message with WalletKey: No key to verify with')
//     }

//     return await this.wallet.verify(this.key.publicKeyBase58, message, signature)
//   }
//   public get hasPublicKey(): boolean {
//     return this.key !== undefined
//   }

//   public get publicKey(): Buffer | undefined {
//     return this.key ? this.key.publicKey : undefined
//   }
//   // eslint-disable-next-line @typescript-eslint/no-explicit-any
//   public fromVerificationMethod(verificationMethod: Record<string, any>): KeyPair {
//     if (!verificationMethod.publicKeyBase58) {
//       throw new AriesFrameworkError('Unable to set public key from verification method: no publicKeyBase58')
//     }

//     return new WalletKeyPair(this.wallet, this.keyType, verificationMethod.publicKeyBase58)
//   }
// }

interface WalletKeyPairReworkOptions extends KeyPairReworkOptions {
  wallet: Wallet
  key: Key
}

class WalletKeyPairRework extends KeyPairRework {
  private wallet: Wallet
  private key: Key

  public constructor(options: WalletKeyPairReworkOptions) {
    super(options)
    this.wallet = options.wallet
    this.key = options.key
  }

  public static async generate(): Promise<WalletKeyPairRework> {
    throw new Error('Not implemented')
  }

  public fingerprint(): string {
    throw new Error('Method not implemented.')
  }
  public verifyFingerprint(fingerprint: string): boolean {
    throw new Error('Method not implemented.')
  }

  public static async fromVerificationMethod(verificationMethod: Record<string, any>): Promise<WalletKeyPairRework> {
    const a = JsonTransformer.fromJSON(verificationMethod, VerificationMethod)
    await MessageValidator.validate(a)
    const { getKeyFromVerificationMethod } = getKeyDidMappingByVerificationMethod(a)
    const key = getKeyFromVerificationMethod(a)

    return new WalletKeyPairRework(this.wallet, key)
  }

  public signer(): { sign: (data: Uint8Array | Uint8Array[]) => Promise<Uint8Array> } {
    return async function sign(data: Uint8Array | Uint8Array[]): Promise<Uint8Array> {
      return await this.wallet.sign(data, this.key.publicKeyBase58)
    }
  }
  public verifier(): { verify: (data: Uint8Array | Uint8Array[], signature: Uint8Array) => Promise<boolean> } {
    throw new Error('Method not implemented.')
  }
}
