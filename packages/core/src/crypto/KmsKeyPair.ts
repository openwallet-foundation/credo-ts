import { AgentContext } from '../agent'
import { CredoError } from '../error'
import { VerificationMethod } from '../modules/dids'
import { getPublicJwkFromVerificationMethod } from '../modules/dids/domain/key-type/keyDidMapping'
import { KeyManagementApi, PublicJwk } from '../modules/kms'
import type { LdKeyPairOptions } from '../modules/vc/data-integrity/models/LdKeyPair'
import { LdKeyPair } from '../modules/vc/data-integrity/models/LdKeyPair'
import type { AnyUint8Array, Uint8ArrayBuffer } from '../types'
import { JsonTransformer, MessageValidator } from '../utils'
import { Buffer } from '../utils/buffer'

interface KmsKeyPairOptions extends LdKeyPairOptions {
  publicJwk: PublicJwk
}

export function createKmsKeyPairClass(agentContext: AgentContext) {
  return class KmsKeyPair extends LdKeyPair {
    public publicJwk: PublicJwk
    public type = 'KmsKeyPair'

    public constructor(options: KmsKeyPairOptions) {
      super(options)
      this.publicJwk = options.publicJwk
    }

    public static async generate(): Promise<KmsKeyPair> {
      throw new Error('Not implemented')
    }

    public fingerprint(): string {
      throw new Error('Method not implemented.')
    }

    public verifyFingerprint(_fingerprint: string): boolean {
      throw new Error('Method not implemented.')
    }

    public static async from(verificationMethod: VerificationMethod): Promise<KmsKeyPair> {
      const vMethod = JsonTransformer.fromJSON(verificationMethod, VerificationMethod)
      MessageValidator.validateSync(vMethod)
      const publicJwk = getPublicJwkFromVerificationMethod(vMethod)

      return new KmsKeyPair({
        id: vMethod.id,
        controller: vMethod.controller,
        publicJwk,
      })
    }

    /**
     * This method returns a wrapped wallet.sign method. The method is being wrapped so we can covert between Uint8Array and Buffer. This is to make it compatible with the external signature libraries.
     */
    public signer(): { sign: (data: { data: AnyUint8Array | AnyUint8Array[] }) => Promise<Uint8ArrayBuffer> } {
      // wrap function for conversion
      const wrappedSign = async (data: { data: AnyUint8Array | AnyUint8Array[] }): Promise<Uint8ArrayBuffer> => {
        if (Array.isArray(data.data)) {
          throw new CredoError('Signing array of data entries is not supported')
        }
        const kms = agentContext.dependencyManager.resolve(KeyManagementApi)

        const result = await kms.sign({
          data: data.data,
          keyId: this.publicJwk.keyId,
          algorithm: this.publicJwk.signatureAlgorithm,
        })

        return result.signature
      }

      return {
        sign: wrappedSign.bind(this),
      }
    }

    /**
     * This method returns a wrapped wallet.verify method. The method is being wrapped so we can covert between Uint8Array and Buffer. This is to make it compatible with the external signature libraries.
     */
    public verifier(): {
      verify: (data: { data: AnyUint8Array | AnyUint8Array[]; signature: AnyUint8Array }) => Promise<boolean>
    } {
      const wrappedVerify = async (data: {
        data: AnyUint8Array | AnyUint8Array[]
        signature: AnyUint8Array
      }): Promise<boolean> => {
        if (Array.isArray(data.data)) {
          throw new CredoError('Verifying array of data entries is not supported')
        }
        const kms = agentContext.dependencyManager.resolve(KeyManagementApi)

        const { verified } = await kms.verify({
          data: data.data,
          signature: Buffer.from(data.signature),
          key: {
            publicJwk: this.publicJwk.toJson(),
          },
          algorithm: this.publicJwk.signatureAlgorithm,
        })

        return verified
      }
      return {
        verify: wrappedVerify.bind(this),
      }
    }

    public get publicKeyBuffer(): Uint8ArrayBuffer {
      const publicKey = this.publicJwk.publicKey

      if (publicKey.kty === 'RSA') {
        throw new CredoError(`kty 'RSA' not supported for publicKeyBuffer`)
      }

      return publicKey.publicKey as Uint8ArrayBuffer
    }
  }
}
