import type { DocumentLoader, JsonLdDoc, Proof, VerificationMethod } from '../../jsonldUtil'
import type { JwsLinkedDataSignatureOptions } from '../JwsLinkedDataSignature'

import { MultiBaseEncoder, TypedArrayEncoder } from '../../../../../utils'
import { CREDENTIALS_CONTEXT_V1_URL, SECURITY_CONTEXT_URL } from '../../../constants'
import { _includesContext } from '../../jsonldUtil'
import jsonld from '../../libraries/jsonld'
import { JwsLinkedDataSignature } from '../JwsLinkedDataSignature'

import { ED25519_SUITE_CONTEXT_URL_2018, ED25519_SUITE_CONTEXT_URL_2020 } from './constants'
import { ed25519Signature2018Context } from './context'

type Ed25519Signature2018Options = Pick<
  JwsLinkedDataSignatureOptions,
  'key' | 'proof' | 'date' | 'useNativeCanonize' | 'LDKeyClass'
>

export class Ed25519Signature2018 extends JwsLinkedDataSignature {
  public static CONTEXT_URL = ED25519_SUITE_CONTEXT_URL_2018
  public static CONTEXT = ed25519Signature2018Context.get(ED25519_SUITE_CONTEXT_URL_2018)

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
      contextUrl: ED25519_SUITE_CONTEXT_URL_2018,
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

    if (!_isEd2018Key(document) && !_isEd2020Key(document)) {
      const verificationMethodType = jsonld.getValues(document, 'type')[0]
      throw new Error(
        `Unsupported verification method type '${verificationMethodType}'. Verification method type MUST be 'Ed25519VerificationKey2018' or 'Ed25519VerificationKey2020'.`
      )
    }
    if (_isEd2018Key(document) && !_includesEd2018Context(document)) {
      throw new Error(
        `For verification method type 'Ed25519VerificationKey2018' the '@context' MUST contain the context url "${ED25519_SUITE_CONTEXT_URL_2018}".`
      )
    }
    if (_isEd2020Key(document) && !_includesEd2020Context(document)) {
      throw new Error(
        `For verification method type 'Ed25519VerificationKey2020' the '@context' MUST contain the context url "${ED25519_SUITE_CONTEXT_URL_2020}".`
      )
    }

    // ensure verification method has not been revoked
    if (document.revoked !== undefined) {
      throw new Error('The verification method has been revoked.')
    }
  }

  public async getVerificationMethod(options: { proof: Proof; documentLoader?: DocumentLoader }) {
    let verificationMethod = await super.getVerificationMethod({
      proof: options.proof,
      documentLoader: options.documentLoader,
    })

    // convert Ed25519VerificationKey2020 to Ed25519VerificationKey2018
    if (_isEd2020Key(verificationMethod) && _includesEd2020Context(verificationMethod)) {
      // -- convert multibase to base58 --
      const publicKeyBuffer = MultiBaseEncoder.decode(verificationMethod.publicKeyMultibase)

      // -- update context --
      // remove 2020 context
      const context2020Index = verificationMethod['@context'].indexOf(ED25519_SUITE_CONTEXT_URL_2020)
      verificationMethod['@context'].splice(context2020Index, 1)

      // add 2018 context
      verificationMethod['@context'].push(ED25519_SUITE_CONTEXT_URL_2018)

      // -- update type
      verificationMethod.type = 'Ed25519VerificationKey2018'

      verificationMethod = {
        ...verificationMethod,
        publicKeyMultibase: undefined,
        publicKeyBase58: TypedArrayEncoder.toBase58(publicKeyBuffer.data),
      }
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
   *
   * @returns {Promise<boolean>} Whether a match for the proof was found.
   */
  public async matchProof(options: {
    proof: Proof
    document: VerificationMethod
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
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
    contextUrl: ED25519_SUITE_CONTEXT_URL_2018,
  })
  const hasEd2020 = _includesContext({
    document: options.document,
    contextUrl: ED25519_SUITE_CONTEXT_URL_2020,
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
  return hasEd2018 || hasEd2020 || hasCred || hasSecV2
}

function _isEd2018Key(verificationMethod: JsonLdDoc) {
  // @ts-ignore - .hasValue is not part of the public API
  return jsonld.hasValue(verificationMethod, 'type', 'Ed25519VerificationKey2018')
}

function _includesEd2018Context(document: JsonLdDoc) {
  return _includesContext({ document, contextUrl: ED25519_SUITE_CONTEXT_URL_2018 })
}

function _isEd2020Key(verificationMethod: JsonLdDoc) {
  // @ts-ignore - .hasValue is not part of the public API
  return jsonld.hasValue(verificationMethod, 'type', 'Ed25519VerificationKey2020')
}

function _includesEd2020Context(document: JsonLdDoc) {
  return _includesContext({ document, contextUrl: ED25519_SUITE_CONTEXT_URL_2020 })
}
