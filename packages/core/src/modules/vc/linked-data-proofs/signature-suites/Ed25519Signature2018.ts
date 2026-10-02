import { CREDENTIALS_CONTEXT_V1_URL, SECURITY_CONTEXT_URL, SECURITY_ED25519_2018_CONTEXT_URL } from '../../constants'
import { DEFAULT_CONTEXTS } from '../../jsonld/contexts'
import jsonld from '../../jsonld/jsonld'
import type { DocumentLoader, JsonLdDoc, Proof, VerificationMethod } from '../proof-ops/jsonldUtil'
import { _includesContext } from '../proof-ops/jsonldUtil'
import type { JwsLinkedDataSignatureOptions } from './JwsLinkedDataSignature'
import { JwsLinkedDataSignature } from './JwsLinkedDataSignature'

const jsonldWithHasValue = jsonld as typeof jsonld & {
  hasValue(document: JsonLdDoc, key: string, value: string): boolean
}

type Ed25519Signature2018Options = Pick<
  JwsLinkedDataSignatureOptions,
  'key' | 'proof' | 'date' | 'useNativeCanonize' | 'LDKeyClass'
>

export class Ed25519Signature2018 extends JwsLinkedDataSignature {
  // TODO: Centralise suite context metadata outside suite class statics.
  public static CONTEXT_URL = SECURITY_ED25519_2018_CONTEXT_URL
  public static CONTEXT = DEFAULT_CONTEXTS[SECURITY_ED25519_2018_CONTEXT_URL]

  /**
   * @param {object} options - Options hashmap.
   *
   * Either a `key` OR at least one of `signer`/`verifier` is required.
   *
   * @param {object} [options.key] - An optional key object (containing an
   *   `id` property, and either `signer` or `verifier`, depending on the
   *   intended operation. Useful for when the application is managing keys
   *   itself (when using a KMS, you never have access to the private key,
   *   and so should use the `signer` param instead).
   * @param {Function} [options.signer] - Signer function that returns an
   *   object with an async sign() method. This is useful when interfacing
   *   with a KMS (since you don't get access to the private key and its
   *   `signer()`, the KMS client gives you only the signer function to use).
   * @param {Function} [options.verifier] - Verifier function that returns
   *   an object with an async `verify()` method. Useful when working with a
   *   KMS-provided verifier function.
   *
   * Advanced optional parameters and overrides.
   *
   * @param {object} [options.proof] - A JSON-LD document with options to use
   *   for the `proof` node. Any other custom fields can be provided here
   *   using a context different from security-v2).
   * @param {string|Date} [options.date] - Signing date to use if not passed.
   * @param {boolean} [options.useNativeCanonize] - Whether to use a native
   *   canonize algorithm.
   */
  public constructor(options: Ed25519Signature2018Options = {}) {
    super({
      type: 'Ed25519Signature2018',
      algorithm: 'EdDSA',
      LDKeyClass: options.LDKeyClass,
      contextUrl: Ed25519Signature2018.CONTEXT_URL,
      key: options.key,
      proof: options.proof,
      date: options.date,
      useNativeCanonize: options.useNativeCanonize,
    })
    this.requiredKeyType = 'Ed25519VerificationKey2018'
  }

  public async assertVerificationMethod(document: JsonLdDoc) {
    if (!_includesCompatibleContext({ document: document })) {
      // For DID Documents, since keys do not have their own contexts,
      // the suite context is usually provided by the documentLoader logic
      throw new TypeError(
        `The '@context' of the verification method (key) MUST contain the context url "${this.contextUrl}".`
      )
    }

    if (!_isEd2018Key(document)) {
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

  /**
   * Ensures the document to be signed contains the required signature suite
   * specific `@context`, by either adding it (if `addSuiteContext` is true),
   * or throwing an error if it's missing.
   *
   * @override
   *
   * @param {object} options - Options hashmap.
   * @param {object} options.document - JSON-LD document to be signed.
   * @param {boolean} options.addSuiteContext - Add suite context?
   */
  public ensureSuiteContext(options: { document: JsonLdDoc; addSuiteContext: boolean }) {
    if (_includesCompatibleContext({ document: options.document })) {
      return
    }

    super.ensureSuiteContext({ document: options.document, addSuiteContext: options.addSuiteContext })
  }

  /**
   * Checks whether a given proof exists in the document.
   *
   * @override
   *
   * @param {object} options - Options hashmap.
   * @param {object} options.proof - A proof.
   * @param {object} options.document - A JSON-LD document.
   * @param {object} options.purpose - A jsonld-signatures ProofPurpose
   *  instance (e.g. AssertionProofPurpose, AuthenticationProofPurpose, etc).
   * @param {Function} options.documentLoader  - A secure document loader (it is
   *   recommended to use one that provides static known documents, instead of
   *   fetching from the web) for returning contexts, controller documents,
   *   keys, and other relevant URLs needed for the proof.
   *
   * @returns {Promise<boolean>} Whether a match for the proof was found.
   */
  public async matchProof(options: {
    proof: Proof
    document: VerificationMethod
    // biome-ignore lint/suspicious/noExplicitAny: no explanation
    purpose: any
    documentLoader?: DocumentLoader
  }) {
    if (!_includesCompatibleContext({ document: options.document })) {
      return false
    }
    return super.matchProof({
      proof: options.proof,
      document: options.document,
      purpose: options.purpose,
      documentLoader: options.documentLoader,
    })
  }
}

function _includesCompatibleContext(options: { document: JsonLdDoc }) {
  // Handle the unfortunate Ed25519Signature2018 / credentials/v1 collision
  const hasEd2018 = _includesContext({
    document: options.document,
    contextUrl: Ed25519Signature2018.CONTEXT_URL,
  })
  const hasCred = _includesContext({ document: options.document, contextUrl: CREDENTIALS_CONTEXT_V1_URL })
  const hasSecV2 = _includesContext({ document: options.document, contextUrl: SECURITY_CONTEXT_URL })

  // TODO: the console.warn statements below should probably be replaced with logging statements. However, this would currently require injection and I'm not sure we want to do that.
  if (hasEd2018 && hasCred) {
    // Warn if both are present
    // console.warn('Warning: The ed25519-2018/v1 and credentials/v1 ' + 'contexts are incompatible.')
    // console.warn('For VCs using Ed25519Signature2018 suite,' + ' using the credentials/v1 context is sufficient.')
    return false
  }

  if (hasEd2018 && hasSecV2) {
    // Warn if both are present
    // console.warn('Warning: The ed25519-2018/v1 and security/v2 ' + 'contexts are incompatible.')
    // console.warn('For VCs using Ed25519Signature2018 suite,' + ' using the security/v2 context is sufficient.')
    return false
  }

  // Either one by itself is fine, for this suite
  return hasEd2018 || hasCred || hasSecV2
}

function _isEd2018Key(verificationMethod: JsonLdDoc) {
  return jsonldWithHasValue.hasValue(verificationMethod, 'type', 'Ed25519VerificationKey2018')
}
