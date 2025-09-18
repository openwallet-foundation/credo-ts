import { SDJwtInstance } from '@sd-jwt/core'
import { DisclosureFrame, PresentationFrame, SDJWTConfig } from '@sd-jwt/types'
import type { AgentContext } from '../../../agent/context'
import { JwtPayload } from '../../../crypto'
import { CredoError } from '../../../error'
import { injectable } from '../../../plugins'
import { JsonTransformer, MessageValidator, TypedArrayEncoder, asArray, nowInSeconds } from '../../../utils'
import { getPublicJwkFromVerificationMethod } from '../../dids/domain/key-type/keyDidMapping'
import { KeyManagementApi } from '../../kms'
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
import {
  extractHolderFromPresentationCredentials,
  getVerificationMethodForJwt,
  validateAndResolveVerificationMethod,
} from '../v2-jwt-utils'
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

    // Add iat and cnf to the payload
    payload.iat = nowInSeconds()
    payload.cnf = options.holder ? (await extractKeyFromHolderBinding(agentContext, options.holder)).cnf : undefined

    // Validate and resolve the verification method
    const publicJwk = await validateAndResolveVerificationMethod(agentContext, options.verificationMethod, [
      'assertionMethod',
    ])

    // Validate the disclosure frame
    const disclosureFrame = options.disclosureFrame as DisclosureFrame<W3cV2JsonCredential> | undefined
    this.validateDisclosureFrame(disclosureFrame)

    const sdJwt = new SDJwtInstance({
      ...this.getBaseSdJwtConfig(agentContext),
      signer: getSdJwtSigner(agentContext, publicJwk),
      hashAlg: options.hashingAlgorithm ?? 'sha-256',
      signAlg: options.alg,
    })

    // Sign SD-JWT
    const compact = await sdJwt.issue<W3cV2JsonCredential>(payload, disclosureFrame, {
      header: {
        typ: 'vc+sd-jwt',
        alg: options.alg,
        kid: options.verificationMethod,
      },
    })

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

    const sdJwt = new SDJwtInstance({
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

      const issuerVerificationMethod = await getVerificationMethodForJwt(agentContext, credential, ['assertionMethod'])
      const issuerPublicKey = getPublicJwkFromVerificationMethod(issuerVerificationMethod)

      const holderBinding = parseHolderBindingFromCredential(credential.sdJwt.prettyClaims)
      const holder = holderBinding ? await extractKeyFromHolderBinding(agentContext, holderBinding) : undefined

      sdJwt.config({
        verifier: getSdJwtVerifier(agentContext, issuerPublicKey),
        kbVerifier: holder ? getSdJwtVerifier(agentContext, holder.publicJwk) : undefined,
      })

      try {
        await sdJwt.verify(credential.encoded, [], false)

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

    // Add the nonce and aud to the payload
    payload.nonce = options.challenge
    payload.aud = options.domain

    const holder = await extractHolderFromPresentationCredentials(agentContext, options.presentation)

    const sdJwt = new SDJwtInstance({
      ...this.getBaseSdJwtConfig(agentContext),
      signer: getSdJwtSigner(agentContext, holder.publicJwk),
      hashAlg: options.hashingAlgorithm ?? 'sha-256',
      signAlg: holder.alg,
    })

    // Validate the disclosure frame
    const disclosureFrame = options.disclosureFrame as DisclosureFrame<W3cV2JsonPresentation> | undefined
    this.validateDisclosureFrame(disclosureFrame)

    // Sign SD-JWT
    const compact = await sdJwt.issue<W3cV2JsonPresentation>(payload, disclosureFrame, {
      header: {
        typ: 'vp+sd-jwt',
        alg: holder.alg,
        kid: holder?.cnf?.kid,
      },
    })

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

      const proverVerificationMethod = await getVerificationMethodForJwt(agentContext, presentation, ['authentication'])
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
    options: W3cV2SdJwtVcPresentOptions
  ): Promise<W3cV2SdJwtVerifiableCredential> {
    const originalCompact =
      options.credential instanceof W3cV2SdJwtVerifiableCredential ? options.credential.encoded : options.credential

    const presentationFrame = options.presentationFrame as PresentationFrame<W3cV2JsonCredential>

    const sdjwt = new SDJwtInstance(this.getBaseSdJwtConfig(agentContext))
    const disclosedCompact = await sdjwt.present(originalCompact, presentationFrame)

    return W3cV2SdJwtVerifiableCredential.fromCompact(disclosedCompact)
  }

  private validateDisclosureFrame(disclosureFrame?: DisclosureFrame<W3cV2JsonCredential | W3cV2JsonPresentation>) {
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

  private getBaseSdJwtConfig(agentContext: AgentContext): SDJWTConfig {
    const kms = agentContext.resolve(KeyManagementApi)

    return {
      hasher: sdJwtVcHasher,
      saltGenerator: (length) => TypedArrayEncoder.toBase64URL(kms.randomBytes({ length })).slice(0, length),
    }
  }
}
