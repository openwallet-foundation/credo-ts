import type { LdKeyPairOptions } from '../modules/vc/data-integrity/models/LdKeyPair'

import { AgentContext } from '../agent'
import { CredoError } from '../error'
import { VerificationMethod } from '../modules/dids'
import { getPublicJwkFromVerificationMethod } from '../modules/dids/domain/key-type/keyDidMapping'
import { KeyManagementApi, PublicJwk } from '../modules/kms'
import { LdKeyPair } from '../modules/vc/data-integrity/models/LdKeyPair'
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
    public signer(): { sign: (data: { data: Uint8Array | Uint8Array[] }) => Promise<Uint8Array> } {
      // wrap function for conversion
      const wrappedSign = async (data: { data: Uint8Array | Uint8Array[] }): Promise<Uint8Array> => {
        let converted: Buffer | Buffer[] = []

        // convert uint8array to buffer
        if (Array.isArray(data.data)) {
          converted = data.data.map((d) => Buffer.from(d))
        } else {
          converted = Buffer.from(data.data)
        }

        const kms = agentContext.dependencyManager.resolve(KeyManagementApi)

        // sign
        const result = await kms.sign({
          // FIXME: need to handle array of data
          data: converted,
          keyId: this.publicJwk.getKeyId(),
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
      verify: (data: { data: Uint8Array | Uint8Array[]; signature: Uint8Array }) => Promise<boolean>
    } {
      const wrappedVerify = async (data: {
        data: Uint8Array | Uint8Array[]
        signature: Uint8Array
      }): Promise<boolean> => {
        let converted: Buffer | Buffer[] = []

        // convert uint8array to buffer
        if (Array.isArray(data.data)) {
          converted = data.data.map((d) => Buffer.from(d))
        } else {
          converted = Buffer.from(data.data)
        }
        const kms = agentContext.dependencyManager.resolve(KeyManagementApi)

        // verify
        const { verified } = await kms.verify({
          data: converted,
          signature: Buffer.from(data.signature),
          key: this.publicJwk.toJson(),
          algorithm: this.publicJwk.signatureAlgorithm,
        })

        return verified
      }
      return {
        verify: wrappedVerify.bind(this),
      }
    }

    public get publicKeyBuffer(): Uint8Array {
      const publicKey = this.publicJwk.publicKey

      if (publicKey.kty === 'RSA') {
        throw new CredoError(`kty 'RSA' not supported for publicKeyBuffer`)
      }

      return publicKey.publicKey
    }
  }
}
