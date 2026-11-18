import { PublicJwk } from '../../../kms'
import { SECURITY_JWS_CONTEXT_URL } from '../../constants'
import { DEFAULT_CONTEXTS } from '../../jsonld/contexts'
import jsonld from '../../jsonld/jsonld'
import type { JsonLdDoc, Proof, VerificationMethod } from '../proof-ops/jsonldUtil'
import { _includesContext } from '../proof-ops/jsonldUtil'
import type { JwsLinkedDataSignatureOptions } from './JwsLinkedDataSignature'
import { JwsLinkedDataSignature } from './JwsLinkedDataSignature'

const jsonldWithHasValue = jsonld as typeof jsonld & {
  hasValue(document: JsonLdDoc, key: string, value: string): boolean
}

type JsonWebSignature2020Options = Pick<
  JwsLinkedDataSignatureOptions,
  'key' | 'proof' | 'date' | 'useNativeCanonize' | 'LDKeyClass' | 'allowUndefinedTerms'
>

/**
 * JsonWebSignature2020 for keys published as `JsonWebKey2020` verification methods. Unlike the Ed25519 suites,
 * the JWS algorithm follows the key (EdDSA, ES256, ES384, ES256K), so it is taken from the key and not fixed.
 */
export class JsonWebSignature2020 extends JwsLinkedDataSignature {
  public static CONTEXT_URL = SECURITY_JWS_CONTEXT_URL
  public static CONTEXT = DEFAULT_CONTEXTS[SECURITY_JWS_CONTEXT_URL]

  public constructor(options: JsonWebSignature2020Options = {}) {
    super({
      type: 'JsonWebSignature2020',
      // Replaced by the algorithm of the key before signing and verifying
      algorithm: 'EdDSA',
      LDKeyClass: options.LDKeyClass,
      contextUrl: JsonWebSignature2020.CONTEXT_URL,
      key: options.key,
      proof: options.proof,
      date: options.date,
      useNativeCanonize: options.useNativeCanonize,
      allowUndefinedTerms: options.allowUndefinedTerms,
    })
    this.requiredKeyType = 'JsonWebKey2020'
  }

  public async sign(options: { verifyData: Uint8Array; proof: Proof }) {
    if (this.key?.publicJwk instanceof PublicJwk) {
      this.alg = this.key.publicJwk.signatureAlgorithm
    }
    return super.sign(options)
  }

  public async verifySignature(options: {
    verifyData: Uint8Array
    verificationMethod: VerificationMethod
    proof: Proof
  }) {
    // The header must carry the algorithm of the key in the verification method, anything else is rejected by the base
    const key = await this.LDKeyClass.from(options.verificationMethod)
    if (key.publicJwk instanceof PublicJwk) {
      this.alg = key.publicJwk.signatureAlgorithm
    }
    return super.verifySignature(options)
  }

  public async assertVerificationMethod(document: JsonLdDoc) {
    if (!_includesContext({ document, contextUrl: this.contextUrl })) {
      // For DID Documents, since keys do not have their own contexts,
      // the suite context is usually provided by the documentLoader logic
      throw new TypeError(
        `The '@context' of the verification method (key) MUST contain the context url "${this.contextUrl}".`
      )
    }

    if (!jsonldWithHasValue.hasValue(document, 'type', 'JsonWebKey2020')) {
      const verificationMethodType = jsonld.getValues(document, 'type')[0]
      throw new Error(
        `Unsupported verification method type '${verificationMethodType}' for proof type '${this.type}'. Verification method type MUST be '${this.requiredKeyType}'.`
      )
    }

    // ensure verification method has not been revoked
    if (document.revoked !== undefined) {
      throw new Error('The verification method has been revoked.')
    }
  }
}
