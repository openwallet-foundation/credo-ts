import type {
  DocumentLoader,
  JsonLdDoc,
  JwsLinkedDataSignatureOptions,
  ProofPurpose,
  VerificationMethod,
  Proof,
} from './JwsLinkedDataSignature'

// @ts-ignore
import { Ed25519VerificationKey2020 } from '@digitalbazaar/ed25519-verification-key-2020'
// @ts-ignore
import jsonld from '@digitalcredentials/jsonld'
import {
  constants as ed25519Signature2018Constants,
  contexts as ed25519Signature2018Contexts,
} from 'ed25519-signature-2018-context'
import { constants as ed25519Signature2020Constants } from 'ed25519-signature-2020-context'

import { TypedArrayEncoder } from '../../utils'

import { JwsLinkedDataSignature } from './JwsLinkedDataSignature'

// 'https://w3id.org/security/suites/ed25519-2018/v1'
const SUITE_CONTEXT_URL = ed25519Signature2018Constants.CONTEXT_URL
// 'https://w3id.org/security/suites/ed25519-2020/v1'
const SUITE_CONTEXT_URL_2020 = ed25519Signature2020Constants.CONTEXT_URL

type Ed25519Signature2018Options = Pick<
  JwsLinkedDataSignatureOptions,
  'key' | 'proof' | 'date' | 'useNativeCanonize' | 'LDKeyClass'
>

export class Ed25519Signature2018 extends JwsLinkedDataSignature {
  public static CONTEXT = SUITE_CONTEXT_URL
  public static CONTEXT_URL = ed25519Signature2018Contexts.get(SUITE_CONTEXT_URL)

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
  public constructor(options: Ed25519Signature2018Options) {
    super({
      type: 'Ed25519Signature2018',
      algorithm: 'EdDSA',
      LDKeyClass: options.LDKeyClass,
      contextUrl: SUITE_CONTEXT_URL,
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
      throw new TypeError(`The verification method (key) must contain "${this.contextUrl}".`)
    }

    if (!(_isEd2018Key(document) || _isEd2020Key(document))) {
      throw new Error(`Invalid key type. Key type must be "${this.requiredKeyType}".`)
    }

    // ensure verification method has not been revoked
    if (document.revoked !== undefined) {
      throw new Error('The verification method has been revoked.')
    }
  }

  public async getVerificationMethod(options: { proof: Proof; documentLoader: DocumentLoader }) {
    const verificationMethod = await super.getVerificationMethod({
      proof: options.proof,
      documentLoader: options.documentLoader,
    })

    // convert Ed25519VerificationKey2020 to Ed25519VerificationKey2018
    if (_isEd2020Key(verificationMethod)) {
      const key2020 = await Ed25519VerificationKey2020.from(verificationMethod)

      const key2018 = key2020.export({ publicKey: true, context: true })

      // remove 2020 public key representation
      delete key2018.publicKeyMultibase

      // create 2018 public key representation
      key2018.publicKeyBase58 = TypedArrayEncoder.toBase58(key2020._publicKeyBuffer)

      return key2018
    }

    return verificationMethod
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
   * @param {Function} [options.expansionMap] - A custom expansion map that is
   *   passed to the JSON-LD processor; by default a function that will throw
   *   an error when unmapped properties are detected in the input, use `false`
   *   to turn this off and allow unmapped properties to be dropped or use a
   *   custom function.
   *
   * @returns {Promise<boolean>} Whether a match for the proof was found.
   */
  public async matchProof(options: {
    proof: Proof
    document: VerificationMethod
    purpose: ProofPurpose
    documentLoader: DocumentLoader
    expansionMap: () => void
  }) {
    if (!_includesCompatibleContext({ document: options.document })) {
      return false
    }
    return super.matchProof({
      proof: options.proof,
      document: options.document,
      purpose: options.purpose,
      documentLoader: options.documentLoader,
      expansionMap: options.expansionMap,
    })
  }
}

function _includesCompatibleContext(options: { document: JsonLdDoc }) {
  // Handle the unfortunate Ed25519Signature2018 / credentials/v1 collision
  const CRED_CONTEXT = 'https://www.w3.org/2018/credentials/v1'
  const SECURITY_CONTEXT = 'https://w3id.org/security/v2'
  const hasEd2018 = _includesContext({
    document: options.document,
    contextUrl: SUITE_CONTEXT_URL,
  })
  const hasEd2020 = _includesContext({
    document: options.document,
    contextUrl: SUITE_CONTEXT_URL_2020,
  })
  const hasCred = _includesContext({ document: options.document, contextUrl: CRED_CONTEXT })
  const hasSecV2 = _includesContext({ document: options.document, contextUrl: SECURITY_CONTEXT })

  // TODO: log commented warnings
  if (hasEd2018 && hasCred) {
    // Warn if both are present
    console.warn('Warning: The ed25519-2018/v1 and credentials/v1 ' + 'contexts are incompatible.')
    console.warn('For VCs using Ed25519Signature2018 suite,' + ' using the credentials/v1 context is sufficient.')
    return false
  }

  if (hasEd2018 && hasSecV2) {
    // Warn if both are present
    console.warn('Warning: The ed25519-2018/v1 and security/v2 ' + 'contexts are incompatible.')
    console.warn('For VCs using Ed25519Signature2018 suite,' + ' using the security/v2 context is sufficient.')
    return false
  }

  // Either one by itself is fine, for this suite
  return hasEd2018 || hasEd2020 || hasCred || hasSecV2
}

/**
 * Tests whether a provided JSON-LD document includes a context url in its
 * `@context` property.
 *
 * @param {object} options - Options hashmap.
 * @param {object} options.document - A JSON-LD document.
 * @param {string} options.contextUrl - A context url.
 *
 * @returns {boolean} Returns true if document includes context.
 */
function _includesContext(options: { document: JsonLdDoc; contextUrl: string }) {
  const context = options.document['@context']

  return context === options.contextUrl || (Array.isArray(context) && context.includes(options.contextUrl))
}

function _isEd2018Key(verificationMethod: JsonLdDoc) {
  const hasEd2018 = _includesContext({
    document: verificationMethod,
    contextUrl: SUITE_CONTEXT_URL,
  })

  // @ts-ignore - .hasValue is not part of the public API
  return hasEd2018 && jsonld.hasValue(verificationMethod, 'type', 'Ed25519VerificationKey2018')
}

function _isEd2020Key(verificationMethod: JsonLdDoc) {
  const hasEd2020 = _includesContext({
    document: verificationMethod,
    contextUrl: SUITE_CONTEXT_URL_2020,
  })

  // @ts-ignore - .hasValue is not part of the public API
  return hasEd2020 && jsonld.hasValue(verificationMethod, 'type', 'Ed25519VerificationKey2020')
}
