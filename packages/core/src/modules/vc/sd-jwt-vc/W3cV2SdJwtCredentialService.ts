import { SDJwtInstance } from '@sd-jwt/core'
import { DisclosureFrame, PresentationFrame, SDJWTConfig } from '@sd-jwt/types'
import type { AgentContext } from '../../../agent/context'
import { JwtPayload } from '../../../crypto'
import { CredoError } from '../../../error'
import { injectable } from '../../../plugins'
import { JsonTransformer, MessageValidator, TypedArrayEncoder, asArray, isDid, nowInSeconds } from '../../../utils'
import type { DidPurpose, VerificationMethod } from '../../dids'
import { DidResolverService, DidsApi, parseDid } from '../../dids'
import {
  getPublicJwkFromVerificationMethod,
  getSupportedVerificationMethodTypesForPublicJwk,
} from '../../dids/domain/key-type/keyDidMapping'
import { KeyManagementApi, KnownJwaSignatureAlgorithm, PublicJwk } from '../../kms'
import {
  extractKeyFromHolderBinding,
  getSdJwtSigner,
  getSdJwtVerifier,
  parseHolderBindingFromCredential,
} from '../../sd-jwt-vc/utils'
import type {
  W3cV2SdJwtSignCredentialOptions,
  W3cV2SdJwtSignPresentationOptions,
  W3cV2SdJwtVcPresentOptions,
  W3cV2SdJwtVerifyCredentialOptions,
  W3cV2SdJwtVerifyPresentationOptions,
} from '../W3cV2CredentialServiceOptions'
import type {
  SingleValidationResult,
  W3cV2JsonCredential,
  W3cV2JsonPresentation,
  W3cV2VerifyCredentialResult,
  W3cV2VerifyPresentationResult,
} from '../models'
import { sdJwtVcHasher } from './W3cV2SdJwt'
import { W3cV2SdJwtVerifiableCredential } from './W3cV2SdJwtVerifiableCredential'
import { W3cV2SdJwtVerifiablePresentation } from './W3cV2SdJwtVerifiablePresentation'

/**
 * List of fields that cannot be selectively disclosed.
 *
 * @see https://www.w3.org/TR/vc-jose-cose/#securing-with-sd-jwt
 * @see https://www.w3.org/TR/vc-jose-cose/#securing-vps-sd-jwt
 */
const NON_DISCLOSEABLE_FIELDS = ['@context', 'type', 'credentialStatus', 'credentialSchema', 'relatedResource']

/**
 * Supports signing and verifying W3C Verifiable Credentials and Presentations
 * secured with Selective Disclosure JSON Web Tokens (SD-JWT).
 *
 * @see https://www.w3.org/TR/vc-data-model/
 * @see https://www.w3.org/TR/vc-jose-cose/#with-sd-jwt
 */
@injectable()
export class W3cV2SdJwtCredentialService {
  /**
   * Signs a credential
   */
  public async signCredential(
    agentContext: AgentContext,
    options: W3cV2SdJwtSignCredentialOptions
  ): Promise<W3cV2SdJwtVerifiableCredential> {
    // Validate the instance
    MessageValidator.validateSync(options.credential)

    // The JWT payload is simply the credential
    const payload = JsonTransformer.toJSON(options.credential) as W3cV2JsonCredential

    if (!isDid(options.verificationMethod)) {
      throw new CredoError('Only did identifiers are supported as verification method')
    }

    const { parsedDid, publicJwk } = await this.resolveVerificationMethod(agentContext, options.verificationMethod, [
      'assertionMethod',
    ])

    if (!parsedDid.fragment) {
      throw new CredoError(
        `didUrl '${parsedDid.didUrl}' does not contain a '#'. Unable to derive key from did document`
      )
    }

    // Holder binding is optional
    const holderBinding = options.holder ? await extractKeyFromHolderBinding(agentContext, options.holder) : undefined

    const sdjwt = new SDJwtInstance({
      ...this.getBaseSdJwtConfig(agentContext),
      signer: getSdJwtSigner(agentContext, publicJwk),
      hashAlg: options.hashingAlgorithm ?? 'sha-256',
      signAlg: options.alg,
    })

    // Validate the disclosure frame
    const disclosureFrame = options.disclosureFrame as DisclosureFrame<W3cV2JsonCredential> | undefined
    this.validateDisclosureFrame(disclosureFrame)

    const compact = await sdjwt.issue<W3cV2JsonCredential>(
      {
        ...payload,
        cnf: holderBinding?.cnf,
        iat: nowInSeconds(),
      },
      disclosureFrame,
      {
        header: {
          alg: options.alg,
          typ: 'vc+sd-jwt',
          kid: `#${parsedDid.fragment}`,
        },
      }
    )

    return W3cV2SdJwtVerifiableCredential.fromCompact(compact)
  }

  /**
   * Verifies the signature(s) of a credential
   *
   * @param credential the credential to be verified
   * @returns the verification result
   */
  public async verifyCredential(
    agentContext: AgentContext,
    options: W3cV2SdJwtVerifyCredentialOptions
  ): Promise<W3cV2VerifyCredentialResult> {
    const validationResults: W3cV2VerifyCredentialResult = {
      isValid: false,
      validations: {},
    }

    const sdjwt = new SDJwtInstance({
      ...this.getBaseSdJwtConfig(agentContext),
    })

    try {
      let credential: W3cV2SdJwtVerifiableCredential
      try {
        // If instance is provided as input, we want to validate the credential
        // Otherwise, it is done by fromCompact below
        if (options.credential instanceof W3cV2SdJwtVerifiableCredential) {
          options.credential.validate()
        }

        credential =
          options.credential instanceof W3cV2SdJwtVerifiableCredential
            ? options.credential
            : W3cV2SdJwtVerifiableCredential.fromCompact(options.credential)

        // Validate JWT payload
        JwtPayload.fromJson(credential.sdJwt.payload).validate()

        validationResults.validations.dataModel = {
          isValid: true,
        }
      } catch (error) {
        validationResults.validations.dataModel = {
          isValid: false,
          error,
        }

        return validationResults
      }

      const issuerVerificationMethod = await this.getVerificationMethodForJwtCredential(agentContext, {
        credential,
        purpose: ['assertionMethod'],
      })
      const issuerPublicKey = getPublicJwkFromVerificationMethod(issuerVerificationMethod)
      const holderBinding = parseHolderBindingFromCredential(credential.sdJwt.prettyClaims)
      const holder = holderBinding ? await extractKeyFromHolderBinding(agentContext, holderBinding) : undefined

      sdjwt.config({
        verifier: getSdJwtVerifier(agentContext, issuerPublicKey),
        kbVerifier: holder ? getSdJwtVerifier(agentContext, holder.publicJwk) : undefined,
      })

      try {
        await sdjwt.verify(credential.encoded, [], false)

        validationResults.validations.signature = {
          isValid: true,
        }
      } catch (error) {
        validationResults.validations.signature = {
          isValid: false,
          error,
        }
      }

      // Validate whether the credential is signed with the 'issuer' id
      // NOTE: this uses the verificationMethod.controller. We may want to use the verificationMethod.id?
      if (credential.resolvedCredential.issuerId !== issuerVerificationMethod.controller) {
        validationResults.validations.issuerIsSigner = {
          isValid: false,
          error: new CredoError(
            `Credential is signed using verification method ${issuerVerificationMethod.id}, while the issuer of the credential is '${credential.resolvedCredential.issuerId}'`
          ),
        }
      } else {
        validationResults.validations.issuerIsSigner = {
          isValid: true,
        }
      }

      validationResults.isValid = Object.values(validationResults.validations).every((v) => v.isValid)
      return validationResults
    } catch (error) {
      validationResults.error = error
      return validationResults
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
    options: W3cV2SdJwtSignPresentationOptions
  ): Promise<W3cV2SdJwtVerifiablePresentation> {
    // Validate the instance
    MessageValidator.validateSync(options.presentation)

    // The JWT payload is simply the presentation
    const payload = JsonTransformer.toJSON(options.presentation) as W3cV2JsonPresentation

    if (!isDid(options.verificationMethod)) {
      throw new CredoError('Only did identifiers are supported as verification method')
    }

    const { publicJwk, parsedDid } = await this.resolveVerificationMethod(agentContext, options.verificationMethod, [
      'assertionMethod',
    ])

    if (!parsedDid.fragment) {
      throw new CredoError(
        `didUrl '${parsedDid.didUrl}' does not contain a '#'. Unable to derive key from did document`
      )
    }

    const sdjwt = new SDJwtInstance({
      ...this.getBaseSdJwtConfig(agentContext),
      signer: getSdJwtSigner(agentContext, publicJwk),
      hashAlg: options.hashingAlgorithm ?? 'sha-256',
      signAlg: options.alg,
    })

    // Validate the disclosure frame
    const disclosureFrame = options.disclosureFrame as DisclosureFrame<W3cV2JsonPresentation> | undefined
    this.validateDisclosureFrame(disclosureFrame)

    const compact = await sdjwt.issue<W3cV2JsonPresentation>(
      {
        ...payload,
        iss: parsedDid.did,
        iat: nowInSeconds(),
        nonce: options.challenge,
        aud: options.domain,
      },
      disclosureFrame,
      {
        header: {
          alg: options.alg,
          typ: 'vp+sd-jwt',
          kid: `#${parsedDid.fragment}`,
        },
      }
    )

    return W3cV2SdJwtVerifiablePresentation.fromCompact(compact)
  }

  /**
   * Verifies a presentation including the credentials it includes
   *
   * @param presentation the presentation to be verified
   * @returns the verification result
   */
  public async verifyPresentation(
    agentContext: AgentContext,
    options: W3cV2SdJwtVerifyPresentationOptions
  ): Promise<W3cV2VerifyPresentationResult> {
    const validationResults: W3cV2VerifyPresentationResult = {
      isValid: false,
      validations: {},
    }

    const sdjwt = new SDJwtInstance({
      ...this.getBaseSdJwtConfig(agentContext),
    })

    try {
      let presentation: W3cV2SdJwtVerifiablePresentation
      try {
        // If instance is provided as input, we want to validate the presentation
        if (options.presentation instanceof W3cV2SdJwtVerifiablePresentation) {
          MessageValidator.validateSync(options.presentation.resolvedPresentation)
        }

        presentation =
          options.presentation instanceof W3cV2SdJwtVerifiablePresentation
            ? options.presentation
            : W3cV2SdJwtVerifiablePresentation.fromCompact(options.presentation)

        // Validate JWT payload
        JwtPayload.fromJson(presentation.sdJwt.payload).validate()

        validationResults.validations.dataModel = {
          isValid: true,
        }
      } catch (error) {
        validationResults.validations.dataModel = {
          isValid: false,
          error,
        }

        return validationResults
      }

      const proverVerificationMethod = await this.getVerificationMethodForJwtCredential(agentContext, {
        credential: presentation,
        purpose: ['authentication'],
      })
      const proverPublicKey = getPublicJwkFromVerificationMethod(proverVerificationMethod)
      const holderBinding = parseHolderBindingFromCredential(presentation.sdJwt.prettyClaims)
      const holder = holderBinding ? await extractKeyFromHolderBinding(agentContext, holderBinding) : undefined

      sdjwt.config({
        verifier: getSdJwtVerifier(agentContext, proverPublicKey),
        kbVerifier: holder ? getSdJwtVerifier(agentContext, holder.publicJwk) : undefined,
      })

      try {
        await sdjwt.verify(presentation.encoded, [], false)

        validationResults.validations.presentationSignature = {
          isValid: true,
        }
      } catch (error) {
        validationResults.validations.presentationSignature = {
          isValid: false,
          error,
        }
      }

      // Validate whether the presentation is signed with the 'holder' id
      // NOTE: this uses the verificationMethod.controller. We may want to use the verificationMethod.id?
      if (
        presentation.resolvedPresentation.holderId &&
        proverVerificationMethod.controller !== presentation.resolvedPresentation.holderId
      ) {
        validationResults.validations.holderIsSigner = {
          isValid: false,
          error: new CredoError(
            `Presentation is signed using verification method ${proverVerificationMethod.id}, while the holder of the presentation is '${presentation.resolvedPresentation.holderId}'`
          ),
        }
      } else {
        // If no holderId is present, this validation passes by default as there can't be
        // a mismatch between the 'holder' property and the signer of the presentation.
        validationResults.validations.holderIsSigner = {
          isValid: true,
        }
      }

      // To keep things simple, we only support JWT VCs in JWT VPs for now
      const credentials = asArray(presentation.resolvedPresentation.verifiableCredential)

      // Verify all credentials in parallel, and await the result
      validationResults.validations.credentials = await Promise.all(
        credentials.map(async (credential) => {
          if (!(credential.envelopedCredential instanceof W3cV2SdJwtVerifiableCredential)) {
            return {
              isValid: false,
              error: new CredoError(
                'Credential is not of format SD-JWT. Presentations in SD-JWT format can only contain credentials in SD-JWT format.'
              ),
              validations: {},
            }
          }

          const credentialResult = await this.verifyCredential(agentContext, {
            credential: credential.envelopedCredential,
          })

          let credentialSubjectAuthentication: SingleValidationResult

          // Check whether any of the credentialSubjectIds for each credential is the same as the controller of the verificationMethod
          // This authenticates the presentation creator controls one of the credentialSubject ids.
          // NOTE: this doesn't take into account the case where the credentialSubject is no the holder. In the
          // future we can add support for other flows, but for now this is the most common use case.
          // TODO: should this be handled on a higher level? I don't really see it being handled in the jsonld lib
          // or in the did-jwt-vc lib (it seems they don't even verify the credentials itself), but we probably need some
          // more experience on the use cases before we loosen the restrictions (as it means we need to handle it on a higher layer).
          const credentialSubjectIds = credential.resolvedCredential.credentialSubjectIds
          const presentationAuthenticatesCredentialSubject = credentialSubjectIds.some(
            (subjectId) => proverVerificationMethod.controller === subjectId
          )

          if (credentialSubjectIds.length > 0 && !presentationAuthenticatesCredentialSubject) {
            credentialSubjectAuthentication = {
              isValid: false,
              error: new CredoError(
                'Credential has one or more credentialSubject ids, but presentation does not authenticate credential subject'
              ),
            }
          } else {
            credentialSubjectAuthentication = {
              isValid: true,
            }
          }

          return {
            ...credentialResult,
            isValid: credentialResult.isValid && credentialSubjectAuthentication.isValid,
            validations: {
              ...credentialResult.validations,
              credentialSubjectAuthentication,
            },
          }
        })
      )

      // Deeply nested check whether all validations have passed
      validationResults.isValid = Object.values(validationResults.validations).every((v) =>
        Array.isArray(v) ? v.every((vv) => vv.isValid) : v.isValid
      )

      return validationResults
    } catch (error) {
      validationResults.error = error
      return validationResults
    }
  }

  public async present(
    agentContext: AgentContext,
    { compactSdJwtVc, presentationFrame, verifierMetadata, additionalPayload }: W3cV2SdJwtVcPresentOptions
  ): Promise<W3cV2SdJwtVerifiableCredential> {
    const sdjwt = new SDJwtInstance(this.getBaseSdJwtConfig(agentContext))

    const sdJwtVc = await sdjwt.decode(compactSdJwtVc)

    const holderBinding = parseHolderBindingFromCredential(sdJwtVc.jwt?.payload)
    if (!holderBinding && verifierMetadata) {
      throw new CredoError("Verifier metadata provided, but credential has no 'cnf' claim to create a KB-JWT from")
    }

    const holder = holderBinding ? await extractKeyFromHolderBinding(agentContext, holderBinding, true) : undefined
    sdjwt.config({
      kbSigner: holder ? getSdJwtSigner(agentContext, holder.publicJwk) : undefined,
      kbSignAlg: holder?.alg,
    })

    const compact = await sdjwt.present(compactSdJwtVc, presentationFrame as PresentationFrame<W3cV2JsonCredential>, {
      kb: verifierMetadata
        ? {
            payload: {
              iat: verifierMetadata.issuedAt,
              nonce: verifierMetadata.nonce,
              aud: verifierMetadata.audience,
              ...additionalPayload,
            },
          }
        : undefined,
    })

    return W3cV2SdJwtVerifiableCredential.fromCompact(compact)
  }

  private validateDisclosureFrame(
    disclosureFrame?:
      | DisclosureFrame<W3cV2JsonCredential | W3cV2JsonPresentation>
      | PresentationFrame<W3cV2JsonCredential | W3cV2JsonPresentation>
  ) {
    if (!disclosureFrame) return

    for (const field of NON_DISCLOSEABLE_FIELDS) {
      if (disclosureFrame[field]) {
        throw new CredoError(`'${field}' property cannot be selectively disclosed`)
      }

      if (Array.isArray(disclosureFrame._sd) && disclosureFrame._sd?.includes(field)) {
        throw new CredoError(`'${field}' property cannot be selectively disclosed`)
      }
    }
  }

  private async resolveVerificationMethod(
    agentContext: AgentContext,
    verificationMethod: string,
    allowsPurposes?: DidPurpose[]
  ) {
    const dids = agentContext.resolve(DidsApi)

    const parsedDid = parseDid(verificationMethod)
    const { didDocument, keys } = await dids.resolveCreatedDidDocumentWithKeys(parsedDid.did)
    const verificationMethodObject = didDocument.dereferenceKey(verificationMethod, allowsPurposes)
    const publicJwk = getPublicJwkFromVerificationMethod(verificationMethodObject)

    publicJwk.keyId =
      keys?.find(({ didDocumentRelativeKeyId }) => verificationMethodObject.id.endsWith(didDocumentRelativeKeyId))
        ?.kmsKeyId ?? publicJwk.legacyKeyId

    return { publicJwk, parsedDid }
  }

  /**
   * This method tries to find the verification method associated with the JWT credential or presentation.
   * This verification method can then be used to verify the credential or presentation signature.
   *
   * The following methods are used to extract the verification method:
   *  - verification method is resolved based on the `kid` in the protected header
   *    - either as absolute reference (e.g. `did:example:123#key-1`)
   *    - or as relative reference to the `iss` of the JWT (e.g. `iss` is `did:example:123` and `kid` is `#key-1`)
   *  - the did document is resolved based on the `iss` field, after which the verification method is extracted based on the `alg`
   *    used to sign the JWT and the specified `purpose`. Only a single verification method may be present, and in all other cases,
   *    an error is thrown.
   *
   * The signer (`iss`) of the JWT is verified against the `controller` of the verificationMethod resolved in the did
   * document. This means if the `iss` of a credential is `did:example:123` and the controller of the verificationMethod
   * is `did:example:456`, an error is thrown to prevent the JWT from successfully being verified.
   *
   * In addition the JWT must conform to one of the following rules:
   *   - MUST be a credential and have an `iss` field and MAY have an absolute or relative `kid`
   *   - MUST not be a credential AND ONE of the following:
   *      - have an `iss` field and MAY have an absolute or relative `kid`
   *      - does not have an `iss` field and MUST have an absolute `kid`
   */
  private async getVerificationMethodForJwtCredential(
    agentContext: AgentContext,
    options: {
      credential: W3cV2SdJwtVerifiableCredential | W3cV2SdJwtVerifiablePresentation
      purpose?: DidPurpose[]
    }
  ) {
    const { credential, purpose } = options
    const kid = credential.sdJwt.header.kid

    const didResolver = agentContext.dependencyManager.resolve(DidResolverService)

    // The signerId is the `holder` of the presentation or the `issuer` of the credential
    let signerId: string | undefined
    if (credential instanceof W3cV2SdJwtVerifiablePresentation) {
      signerId ??= credential.resolvedPresentation.holderId ?? credential.sdJwt.payload.iss
    } else {
      signerId = credential.resolvedCredential.issuerId ?? credential.sdJwt.payload.iss
    }

    let verificationMethod: VerificationMethod

    // If the kid starts with # we assume it is a relative did url, and we resolve it based on the `iss` and the `kid`
    if (kid?.startsWith('#')) {
      if (!signerId) {
        throw new CredoError(`JWT 'kid' MUST be absolute when when no 'iss' is present in JWT payload`)
      }

      const didDocument = await didResolver.resolveDidDocument(agentContext, signerId)
      verificationMethod = didDocument.dereferenceKey(`${signerId}${kid}`, purpose)
    }
    // this is a full did url (todo check if it contains a #)
    else if (kid && isDid(kid)) {
      const didDocument = await didResolver.resolveDidDocument(agentContext, kid)

      verificationMethod = didDocument.dereferenceKey(kid, purpose)

      if (signerId && didDocument.id !== signerId) {
        throw new CredoError(`kid '${kid}' does not match id of signer (holder/issuer) '${signerId}'`)
      }
    } else {
      if (!signerId) {
        throw new CredoError(`JWT 'iss' MUST be present in payload when no 'kid' is specified`)
      }

      // Find the verificationMethod in the did document based on the alg and proofPurpose
      const jwkClass = PublicJwk.supportedPublicJwkClassForSignatureAlgorithm(
        credential.sdJwt.header.alg as KnownJwaSignatureAlgorithm
      )
      const supportedVerificationMethodTypes = getSupportedVerificationMethodTypesForPublicJwk(jwkClass)

      const didDocument = await didResolver.resolveDidDocument(agentContext, signerId)
      const verificationMethods =
        didDocument.assertionMethod
          ?.map((v) => (typeof v === 'string' ? didDocument.dereferenceVerificationMethod(v) : v))
          .filter((v) => supportedVerificationMethodTypes.includes(v.type)) ?? []

      if (verificationMethods.length === 0) {
        throw new CredoError(
          `No verification methods found for signer '${signerId}' and key type '${jwkClass.name}' for alg '${credential.sdJwt.header.alg}'. Unable to determine which public key is associated with the credential.`
        )
      }
      if (verificationMethods.length > 1) {
        throw new CredoError(
          `Multiple verification methods found for signer '${signerId}' and key type '${jwkClass.name}' for alg '${credential.sdJwt.header.alg}'. Unable to determine which public key is associated with the credential.`
        )
      }

      verificationMethod = verificationMethods[0]
    }

    // Verify the controller of the verificationMethod matches the signer of the credential
    if (signerId && verificationMethod.controller !== signerId) {
      throw new CredoError(
        `Verification method controller '${verificationMethod.controller}' does not match the signer '${signerId}'`
      )
    }

    return verificationMethod
  }

  private getBaseSdJwtConfig(agentContext: AgentContext): SDJWTConfig {
    const kms = agentContext.resolve(KeyManagementApi)

    return {
      hasher: sdJwtVcHasher,
      saltGenerator: (length) => TypedArrayEncoder.toBase64URL(kms.randomBytes({ length })).slice(0, length),
    }
  }
}
