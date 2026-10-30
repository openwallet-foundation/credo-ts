import type { AgentContext } from '../../../agent/context'
import { TrustedIssuerContext } from '../../../agent/TrustedIssuerContext'
import type { GetTrustedIssuersForCredential, TrustedIssuerDid } from '../../../agent/TrustedIssuersForVerification'
import { createKmsKeyPairClass } from '../../../crypto/KmsKeyPair'
import { CredoError, RecordNotFoundError } from '../../../error'
import { injectable } from '../../../plugins'
import type { SingleOrArray } from '../../../types'
import { asArray, JsonTransformer } from '../../../utils'
import { type DidPurpose, DidsApi, parseDid } from '../../dids'
import { ANONCREDS_W3C_CREDENTIAL_CRYPTOSUITE } from '../anoncreds-w3c-credential'
import { CREDENTIALS_CREDENTIAL_SUBJECT_URL } from '../constants'
import { JsonLdModuleConfig } from '../jsonld'
import jsonld from '../jsonld/jsonld'
import type { SingleValidationResult, W3cVerifyCredentialResult, W3cVerifyPresentationResult } from '../models'
import type { W3cJsonCredential } from '../models/credential/W3cJsonCredential'
import { assertControlledByDid } from '../resolveSigner'
import { validateCredentialSubjectAuthentication, w3cDate } from '../util'
import type {
  W3cJsonLdSignCredentialOptions,
  W3cJsonLdSignPresentationOptions,
  W3cJsonLdVerifyCredentialOptions,
  W3cJsonLdVerifyPresentationOptions,
} from '../W3cCredentialServiceOptions'
import vc from './adapters/vc-adapter'
import { W3cJsonLdVerifiableCredential } from './models/W3cJsonLdVerifiableCredential'
import { W3cJsonLdVerifiablePresentation } from './models/W3cJsonLdVerifiablePresentation'
import { assertOnlyW3cJsonLdVerifiableCredentials } from './proof-ops/jsonldUtil'
import { SignatureSuiteRegistry } from './SignatureSuiteRegistry'
import { W3cJsonLdCredentialSigningNotSupportedError } from './W3cJsonLdCredentialSigningNotSupportedError'

/**
 * Supports signing and verification of credentials according to the [Verifiable Credential Data Model](https://www.w3.org/TR/vc-data-model)
 * using [Linked Data Proofs](https://www.w3.org/TR/vc-data-model/#proofs).
 */
@injectable()
export class W3cJsonLdCredentialService {
  private signatureSuiteRegistry: SignatureSuiteRegistry
  private jsonLdModuleConfig: JsonLdModuleConfig

  public constructor(signatureSuiteRegistry: SignatureSuiteRegistry, jsonLdModuleConfig: JsonLdModuleConfig) {
    this.signatureSuiteRegistry = signatureSuiteRegistry
    this.jsonLdModuleConfig = jsonLdModuleConfig
  }

  /**
   * Signs a credential
   */
  public async signCredential(
    agentContext: AgentContext,
    options: W3cJsonLdSignCredentialOptions
  ): Promise<W3cJsonLdVerifiableCredential> {
    const { suite } = await this.prepareSigningSuite(agentContext, {
      proofType: options.proofType,
      verificationMethodId: options.verificationMethod,
      allowedPurposes: options.proofPurpose?.term ? [options.proofPurpose.term] : ['assertionMethod'],
      date: options.created ?? w3cDate(),
      controller: options.credential.issuerId,
    })

    try {
      const result = await vc.issue({
        credential: JsonTransformer.toJSON(options.credential),
        suite: suite,
        purpose: options.proofPurpose,
        documentLoader: this.jsonLdModuleConfig.documentLoader(agentContext),
      })

      return JsonTransformer.fromJSON(result, W3cJsonLdVerifiableCredential)
    } catch (error) {
      throw new CredoError(`Error issuing W3C JSON-LD VC. ${error.message}`, {
        cause: error,
      })
    }
  }

  /**
   * Validate that the agent can prepare to sign a credential with the given proof type and verification method.
   */
  public async assertCanSignCredential(
    agentContext: AgentContext,
    options: Pick<W3cJsonLdSignCredentialOptions, 'proofType' | 'verificationMethod'> & { controller?: string }
  ): Promise<void> {
    await this.prepareSigningSuite(agentContext, {
      proofType: options.proofType,
      verificationMethodId: options.verificationMethod,
      allowedPurposes: ['assertionMethod'],
      controller: options.controller,
    })
  }

  /**
   * Verifies the signature(s) of a credential
   *
   * @param credential the credential to be verified
   * @returns the verification result
   */
  public async verifyCredential(
    agentContext: AgentContext,
    options: W3cJsonLdVerifyCredentialOptions
  ): Promise<W3cVerifyCredentialResult> {
    try {
      this.assertNoAnonCredsW3cCredentialProof(options.credential.proof)

      const verifyCredentialStatus = options.verifyCredentialStatus ?? true

      await this.ensureCredentialIssuerTrusted(agentContext, options.credential, options.trustedIssuers)

      const suites = this.getSignatureSuitesForCredential(agentContext, options.credential)

      const verifyOptions: Record<string, unknown> = {
        credential: JsonTransformer.toJSON(options.credential),
        suite: suites,
        documentLoader: this.jsonLdModuleConfig.documentLoader(agentContext),
        checkStatus: ({ credential }: { credential: W3cJsonCredential }) => {
          // Only throw error if credentialStatus is present
          if (verifyCredentialStatus && 'credentialStatus' in credential) {
            throw new CredoError('Verifying credential status for JSON-LD credentials is currently not supported')
          }
          return {
            verified: true,
          }
        },
      }

      // this is a hack because vcjs throws if purpose is passed as undefined or null
      if (options.proofPurpose) {
        verifyOptions.purpose = options.proofPurpose
      }

      const result = await vc.verifyCredential(verifyOptions)

      const { verified: isValid, ...remainingResult } = result

      if (!isValid) {
        agentContext.config.logger.debug(`Credential verification failed: ${result.error?.message}`, {
          stack: result.error?.stack,
        })
      }

      // We map the result to our own result type to make it easier to work with
      // however, for now we just add a single vcJs validation result as we don't
      // have access to the internal validation results of vc-js
      return {
        isValid,
        validations: {
          vcJs: {
            isValid,
            ...remainingResult,
          },
        },
        error: result.error,
      }
    } catch (error) {
      return {
        isValid: false,
        validations: {},
        error,
      }
    }
  }

  /**
   * Signs a presentation including the credentials it includes
   *
   * @param presentation the presentation to be signed
   * @returns the signed presentation
   */
  public async signPresentation(
    agentContext: AgentContext,
    options: W3cJsonLdSignPresentationOptions
  ): Promise<W3cJsonLdVerifiablePresentation> {
    const { suite } = await this.prepareSigningSuite(agentContext, {
      proofType: options.proofType,
      verificationMethodId: options.verificationMethod,
      allowedPurposes: options.proofPurpose?.term ? [options.proofPurpose.term] : ['authentication'],
      date: new Date().toISOString(),
    })

    const signOptions: Record<string, unknown> = {
      presentation: JsonTransformer.toJSON(options.presentation),
      suite: suite,
      challenge: options.challenge,
      domain: options.domain,
      documentLoader: this.jsonLdModuleConfig.documentLoader(agentContext),
    }

    // this is a hack because vcjs throws if purpose is passed as undefined or null
    if (options.proofPurpose) {
      signOptions.purpose = options.proofPurpose
    }

    const result = await vc.signPresentation(signOptions)

    return JsonTransformer.fromJSON(result, W3cJsonLdVerifiablePresentation)
  }

  /**
   * Verifies a presentation including the credentials it includes
   *
   * @param presentation the presentation to be verified
   * @returns the verification result
   */
  public async verifyPresentation(
    agentContext: AgentContext,
    options: W3cJsonLdVerifyPresentationOptions
  ): Promise<W3cVerifyPresentationResult> {
    try {
      this.assertNoAnonCredsW3cCredentialProof(options.presentation.proof)

      // create keyPair
      const WalletKeyPair = createKmsKeyPairClass(agentContext)

      let proofs = options.presentation.proof

      if (!Array.isArray(proofs)) {
        proofs = [proofs]
      }
      if (options.purpose) {
        proofs = proofs.filter((proof) => proof.proofPurpose === options.purpose.term)
      }

      const presentationSuites = proofs.map((proof) => {
        const SuiteClass = this.signatureSuiteRegistry.getByProofType(proof.type).suiteClass
        return new SuiteClass({
          LDKeyClass: WalletKeyPair,
          proof: {
            verificationMethod: proof.verificationMethod,
          },
          date: proof.created,
          useNativeCanonize: false,
        })
      })

      const credentials = asArray(options.presentation.verifiableCredential)
      assertOnlyW3cJsonLdVerifiableCredentials(credentials)

      for (const credential of credentials) {
        this.assertNoAnonCredsW3cCredentialProof(credential.proof)
        await this.ensureCredentialIssuerTrusted(agentContext, credential, options.trustedIssuers)
      }

      const credentialSuites = credentials.map((credential) =>
        this.getSignatureSuitesForCredential(agentContext, credential)
      )
      const allSuites = presentationSuites.concat(...credentialSuites)

      const verifyOptions: Record<string, unknown> = {
        presentation: JsonTransformer.toJSON(options.presentation),
        suite: allSuites,
        challenge: options.challenge,
        domain: options.domain,
        documentLoader: this.jsonLdModuleConfig.documentLoader(agentContext),
      }

      // this is a hack because vcjs throws if purpose is passed as undefined or null
      if (options.purpose) {
        verifyOptions.presentationPurpose = options.purpose
      }

      const result = await vc.verify(verifyOptions)

      const { verified: isValid, ...remainingResult } = result

      // The vc-js / jsonld-signatures libraries verify the presentation proof and each embedded
      // credential's issuer proof, but do NOT bind the presentation signer (holder) to the
      // credentialSubject of the embedded credentials. Without this check an attacker could wrap
      // someone else's credential (a data object, not a secret) in a presentation signed with their
      // own key and have it accepted. Enforce the binding here, mirroring the jwt_vp and sd-jwt paths
      // (see validateCredentialSubjectAuthentication).
      //
      // The holders are the signers of the presentation proofs that vc-js verified for their proof
      // purpose. A proof set passes when one proof verifies, so the other proofs don't count.
      const holderVerificationMethods = new Set(
        (result.presentationResult?.results ?? []).flatMap((proofResult) =>
          proofResult.verified === true ? [proofResult.proof.verificationMethod] : []
        )
      )

      // The subject ids come from the expanded credential, as the signed data is the same for `id`,
      // `@id` or another alias of `@id`.
      const [holders, credentialsSubjectIds] = await Promise.all([
        Promise.all(
          Array.from(holderVerificationMethods, (verificationMethod) =>
            this.resolveSigner(agentContext, verificationMethod)
          )
        ),
        Promise.all(credentials.map((credential) => this.getExpandedCredentialSubjectIds(agentContext, credential))),
      ])

      // Surfaced per credential under `credentials[]` to mirror the jwt_vp result shape. The
      // library-level signature/status validations remain lumped in `vcJs`, so each entry here
      // only carries the credentialSubjectAuthentication check.
      const credentialValidations = credentialsSubjectIds.map((credentialSubjectIds) => {
        // A credential without subject identifiers is treated as a bearer credential,
        // so there is no subject to authenticate.
        const isAuthenticated =
          credentialSubjectIds.length === 0 ||
          holders.some((holder) => validateCredentialSubjectAuthentication(credentialSubjectIds, holder).isValid)

        const credentialSubjectAuthentication: SingleValidationResult = isAuthenticated
          ? { isValid: true }
          : {
              isValid: false,
              error: new CredoError(
                'Presentation does not authenticate the credentialSubject of one or more included credentials'
              ),
            }

        return {
          isValid: credentialSubjectAuthentication.isValid,
          validations: { credentialSubjectAuthentication },
        }
      })

      // We map the result to our own result type to make it easier to work with. The library
      // validations are lumped into a single vcJs result as we don't have access to the internal
      // validation results of vc-js; the credentialSubject authentication check that Credo performs
      // on top is surfaced per credential under `credentials`.
      return {
        isValid: isValid && credentialValidations.every((credential) => credential.isValid),
        validations: {
          vcJs: {
            isValid,
            ...remainingResult,
          },
          credentials: credentialValidations,
        },
        error:
          result.error ??
          credentialValidations.find((credential) => !credential.isValid)?.validations.credentialSubjectAuthentication
            .error,
      }
    } catch (error) {
      return {
        isValid: false,
        validations: {},
        error,
      }
    }
  }

  public getVerificationMethodTypesByProofType(proofType: string): string[] {
    return this.getSigningSuiteInfo(proofType).verificationMethodTypes
  }

  public async getExpandedTypesForCredential(agentContext: AgentContext, credential: W3cJsonLdVerifiableCredential) {
    const expandedTypes: SingleOrArray<string> = (await this.expandCredential(agentContext, credential))['@type']

    return asArray(expandedTypes)
  }

  /**
   * Returns the credential subject ids from the expanded credential. This includes ids under `@id` or
   * another alias of `@id`, which `credentialSubjectIds` doesn't read.
   */
  private async getExpandedCredentialSubjectIds(
    agentContext: AgentContext,
    credential: W3cJsonLdVerifiableCredential
  ): Promise<string[]> {
    const expandedSubjects: Array<{ '@id'?: string }> =
      (await this.expandCredential(agentContext, credential))[CREDENTIALS_CREDENTIAL_SUBJECT_URL] ?? []

    return expandedSubjects.flatMap((subject) => (typeof subject['@id'] === 'string' ? [subject['@id']] : []))
  }

  private async expandCredential(agentContext: AgentContext, credential: W3cJsonLdVerifiableCredential) {
    const [expandedCredential] = await jsonld.expand(JsonTransformer.toJSON(credential), {
      documentLoader: this.jsonLdModuleConfig.documentLoader(agentContext),
    })

    return expandedCredential
  }

  private async ensureCredentialIssuerTrusted(
    agentContext: AgentContext,
    credential: W3cJsonLdVerifiableCredential,
    trustedIssuers?: TrustedIssuerDid[] | GetTrustedIssuersForCredential
  ): Promise<void> {
    const issuerId = credential.issuerId

    // Only enforced for did-based issuers
    if (!issuerId.startsWith('did:')) return

    const issuerDid = parseDid(issuerId).did

    for (const proof of asArray(credential.proof)) {
      const verificationMethod = proof.verificationMethod
      if (
        !verificationMethod.startsWith('did:') ||
        (await this.resolveSigner(agentContext, verificationMethod)) !== issuerDid
      ) {
        throw new CredoError(
          `The proof verification method '${verificationMethod}' does not match the credential issuer did '${issuerDid}'.`
        )
      }

      await TrustedIssuerContext.ensureTrustedCredentialSigner(
        agentContext,
        {
          signer: { method: 'did', didUrl: verificationMethod },
          verification: { type: 'credential', credential },
        },
        trustedIssuers
      )
    }
  }

  /**
   * Resolves the DID that signed with a verification method, loading it through the configured
   * document loader like vc-js does. vc-js has already validated its proof purpose.
   */
  private async resolveSigner(agentContext: AgentContext, verificationMethodId: string) {
    const did = parseDid(verificationMethodId).did
    const { document } = await this.jsonLdModuleConfig.documentLoader(agentContext)(verificationMethodId)
    assertControlledByDid({ id: verificationMethodId, controller: document.controller }, did)

    return did
  }

  private getSigningSuiteInfo(proofType: string) {
    if (!this.signatureSuiteRegistry.supportedProofTypes.includes(proofType)) {
      throw new W3cJsonLdCredentialSigningNotSupportedError(
        `The requested proofType ${proofType} is not supported`,
        'unsupported-proof-type'
      )
    }

    return this.signatureSuiteRegistry.getByProofType(proofType)
  }

  private async prepareSigningSuite(
    agentContext: AgentContext,
    options: {
      proofType: string
      verificationMethodId: string
      allowedPurposes: Array<DidPurpose | 'verificationMethod'>
      date?: string
      controller?: string
    }
  ) {
    const suiteInfo = this.getSigningSuiteInfo(options.proofType)

    const dids = agentContext.resolve(DidsApi)
    let resolved: Awaited<ReturnType<typeof dids.resolveVerificationMethodFromCreatedDidRecord>>
    try {
      resolved = await dids.resolveVerificationMethodFromCreatedDidRecord(
        options.verificationMethodId,
        options.allowedPurposes
      )
    } catch (error) {
      if (error instanceof RecordNotFoundError) {
        throw new W3cJsonLdCredentialSigningNotSupportedError(
          error.message,
          'verification-method-not-controlled',
          error
        )
      }
      if (
        error instanceof CredoError &&
        error.message ===
          `Unable to locate verification method with id '${options.verificationMethodId}' in purposes ${options.allowedPurposes}`
      ) {
        throw new W3cJsonLdCredentialSigningNotSupportedError(error.message, 'verification-method-not-found', error)
      }
      throw error
    }

    const { verificationMethod: nativeVerificationMethod, publicJwk } = resolved

    if (!suiteInfo.verificationMethodTypes.includes(nativeVerificationMethod.type)) {
      throw new W3cJsonLdCredentialSigningNotSupportedError(
        `Unsupported verification method type '${nativeVerificationMethod.type}' for proof type '${options.proofType}'. Supported types are: ${suiteInfo.verificationMethodTypes.join(', ')}`,
        'unsupported-verification-method-type'
      )
    }

    const documentLoader = this.jsonLdModuleConfig.documentLoader(agentContext)
    const loaderResult = await documentLoader(options.verificationMethodId)
    const framedVerificationMethod =
      typeof loaderResult.document === 'string' ? JSON.parse(loaderResult.document) : loaderResult.document

    const WalletKeyPair = createKmsKeyPairClass(agentContext)

    // Instantiate suite to validate verification method and framing context
    const SuiteClass = suiteInfo.suiteClass
    const validationSuite = new SuiteClass({
      LDKeyClass: WalletKeyPair,
      proof: {
        verificationMethod: options.verificationMethodId,
      },
      useNativeCanonize: false,
      date: options.date ?? w3cDate(),
    })

    await validationSuite.assertVerificationMethod(framedVerificationMethod)

    const suitesForKey = this.signatureSuiteRegistry.getAllByPublicJwkType(publicJwk)
    if (!suitesForKey.some(({ suiteClass }) => suiteClass === suiteInfo.suiteClass)) {
      throw new W3cJsonLdCredentialSigningNotSupportedError(
        'The key type of the verification method does not match the suite',
        'unsupported-key-type'
      )
    }

    const keyPair = new WalletKeyPair({
      controller:
        options.controller ?? (framedVerificationMethod.controller as string) ?? nativeVerificationMethod.controller,
      id: options.verificationMethodId,
      publicJwk,
    })

    const suite = new SuiteClass({
      key: keyPair,
      LDKeyClass: WalletKeyPair,
      proof: {
        verificationMethod: options.verificationMethodId,
      },
      useNativeCanonize: false,
      date: options.date ?? w3cDate(),
    })

    return { suite, suiteInfo, keyPair, WalletKeyPair }
  }

  private getSignatureSuitesForCredential(agentContext: AgentContext, credential: W3cJsonLdVerifiableCredential) {
    const WalletKeyPair = createKmsKeyPairClass(agentContext)

    let proofs = credential.proof

    if (!Array.isArray(proofs)) {
      proofs = [proofs]
    }

    return proofs.map((proof) => {
      const SuiteClass = this.signatureSuiteRegistry.getByProofType(proof.type).suiteClass
      return new SuiteClass({
        LDKeyClass: WalletKeyPair,
        proof: {
          verificationMethod: proof.verificationMethod,
        },
        date: proof.created,
        useNativeCanonize: false,
      })
    })
  }

  private assertNoAnonCredsW3cCredentialProof(
    proofsInput: W3cJsonLdVerifiableCredential['proof'] | W3cJsonLdVerifiablePresentation['proof']
  ) {
    const proofs = asArray(proofsInput)
    const hasAnonCredsW3cCredentialProof = proofs.some(
      (proof) =>
        proof.type === 'DataIntegrityProof' &&
        'cryptosuite' in proof &&
        proof.cryptosuite === ANONCREDS_W3C_CREDENTIAL_CRYPTOSUITE
    )

    if (hasAnonCredsW3cCredentialProof) {
      throw new CredoError(
        'W3C credential proof with cryptosuite anoncreds-2023 must be verified through the anoncreds W3C credential path, not the generic linked-data verifier'
      )
    }
  }
}
