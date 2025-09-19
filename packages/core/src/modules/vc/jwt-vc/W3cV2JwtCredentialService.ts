import type { AgentContext } from '../../../agent/context'
import { JwsService, JwtPayload } from '../../../crypto'
import type { VerifyJwsResult } from '../../../crypto/JwsService'
import { CredoError } from '../../../error'
import { injectable } from '../../../plugins'
import { JsonTransformer, MessageValidator, asArray, nowInSeconds } from '../../../utils'
import { getPublicJwkFromVerificationMethod } from '../../dids/domain/key-type/keyDidMapping'
import { extractKeyFromHolderBinding } from '../../sd-jwt-vc/utils'
import type {
  W3cV2JwtSignCredentialOptions,
  W3cV2JwtSignPresentationOptions,
  W3cV2JwtVerifyCredentialOptions,
  W3cV2JwtVerifyPresentationOptions,
} from '../W3cV2CredentialServiceOptions'
import type { SingleValidationResult, W3cV2VerifyCredentialResult, W3cV2VerifyPresentationResult } from '../models'
import {
  extractHolderFromPresentationCredentials,
  getVerificationMethodForJwt,
  validateAndResolveVerificationMethod,
} from '../v2-jwt-utils'
import { W3cV2JwtVerifiableCredential } from './W3cV2JwtVerifiableCredential'
import { W3cV2JwtVerifiablePresentation } from './W3cV2JwtVerifiablePresentation'

/**
 * Supports signing and verifying W3C Verifiable Credentials and Presentations
 * secured with JSON Web Tokens (JWT).
 *
 * @see https://www.w3.org/TR/vc-data-model/
 * @see https://www.w3.org/TR/vc-jose-cose/#with-jose
 */
@injectable()
export class W3cV2JwtCredentialService {
  private jwsService: JwsService

  public constructor(jwsService: JwsService) {
    this.jwsService = jwsService
  }

  /**
   * Signs a credential
   */
  public async signCredential(
    agentContext: AgentContext,
    options: W3cV2JwtSignCredentialOptions
  ): Promise<W3cV2JwtVerifiableCredential> {
    // Validate the instance
    MessageValidator.validateSync(options.credential)

    // The JWT payload is simply the credential
    const jwtPayload = new JwtPayload({
      additionalClaims: JsonTransformer.toJSON(options.credential),
    })

    // Add iat and cnf to the payload
    jwtPayload.iat = nowInSeconds()
    jwtPayload.additionalClaims.cnf = options.holder
      ? (await extractKeyFromHolderBinding(agentContext, options.holder)).cnf
      : undefined

    // Validate and resolve the verification method
    const publicJwk = await validateAndResolveVerificationMethod(agentContext, options.verificationMethod, [
      'assertionMethod',
    ])

    // Sign the JWT
    const jwt = await this.jwsService.createJwsCompact(agentContext, {
      payload: jwtPayload,
      keyId: publicJwk.keyId,
      protectedHeaderOptions: {
        typ: 'vc+jwt',
        alg: options.alg,
        kid: options.verificationMethod,
      },
    })

    return W3cV2JwtVerifiableCredential.fromCompact(jwt)
  }

  /**
   * Verifies the signature(s) of a credential
   *
   * @param credential the credential to be verified
   * @returns the verification result
   */
  public async verifyCredential(
    agentContext: AgentContext,
    options: W3cV2JwtVerifyCredentialOptions
  ): Promise<W3cV2VerifyCredentialResult> {
    const validationResults: W3cV2VerifyCredentialResult = {
      isValid: false,
      validations: {},
    }

    try {
      let credential: W3cV2JwtVerifiableCredential
      try {
        // If instance is provided as input, we want to validate the credential.
        // Otherwise, it is done by the fromCompact method below
        if (options.credential instanceof W3cV2JwtVerifiableCredential) {
          options.credential.validate()
        }

        credential =
          options.credential instanceof W3cV2JwtVerifiableCredential
            ? options.credential
            : W3cV2JwtVerifiableCredential.fromCompact(options.credential)

        // Verify the JWT payload (verifies whether it's not expired, etc...)
        credential.jwt.payload.validate()

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

      let signatureResult: VerifyJwsResult | undefined = undefined
      try {
        // Verify the JWS signature
        signatureResult = await this.jwsService.verifyJws(agentContext, {
          jws: credential.jwt.serializedJwt,
          // We have pre-fetched the key based on the issuer/signer of the credential
          jwsSigner: {
            method: 'did',
            jwk: issuerPublicKey,
            didUrl: issuerVerificationMethod.id,
          },
        })

        if (!signatureResult.isValid) {
          validationResults.validations.signature = {
            isValid: false,
            error: new CredoError('Invalid JWS signature'),
          }
        } else {
          validationResults.validations.signature = {
            isValid: true,
          }
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

      // Validate whether the `issuer` of the credential is also the signer
      const issuerIsSigner = signatureResult?.jwsSigners.some(
        (jwsSigner) => jwsSigner.jwk.fingerprint === issuerPublicKey.fingerprint
      )
      if (!issuerIsSigner) {
        validationResults.validations.issuerIsSigner = {
          isValid: false,
          error: new CredoError('Credential is not signed by the issuer of the credential'),
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
    options: W3cV2JwtSignPresentationOptions
  ): Promise<W3cV2JwtVerifiablePresentation> {
    // Validate the instance
    MessageValidator.validateSync(options.presentation)

    // The JWT payload is simply the presentation
    const jwtPayload = new JwtPayload({
      additionalClaims: JsonTransformer.toJSON(options.presentation),
    })

    // Add the nonce and aud to the payload
    jwtPayload.additionalClaims.nonce = options.challenge
    jwtPayload.aud = options.domain

    const holder = await extractHolderFromPresentationCredentials(agentContext, options.presentation)

    // Sign JWT
    const jwt = await this.jwsService.createJwsCompact(agentContext, {
      payload: jwtPayload,
      keyId: holder.publicJwk.keyId,
      protectedHeaderOptions: {
        typ: 'vp+jwt',
        alg: holder.alg,
        kid: holder?.cnf?.kid,
      },
    })

    return W3cV2JwtVerifiablePresentation.fromCompact(jwt)
  }

  /**
   * Verifies a presentation including the credentials it includes
   *
   * @param presentation the presentation to be verified
   * @returns the verification result
   */
  public async verifyPresentation(
    agentContext: AgentContext,
    options: W3cV2JwtVerifyPresentationOptions
  ): Promise<W3cV2VerifyPresentationResult> {
    const validationResults: W3cV2VerifyPresentationResult = {
      isValid: false,
      validations: {},
    }

    try {
      let presentation: W3cV2JwtVerifiablePresentation
      try {
        // If instance is provided as input, we want to validate the presentation
        if (options.presentation instanceof W3cV2JwtVerifiablePresentation) {
          options.presentation.validate()
        }

        presentation =
          options.presentation instanceof W3cV2JwtVerifiablePresentation
            ? options.presentation
            : W3cV2JwtVerifiablePresentation.fromCompact(options.presentation)

        // Verify the JWT payload (verifies whether it's not expired, etc...)
        presentation.jwt.payload.validate()

        // Make sure challenge matches nonce
        if (options.challenge !== presentation.jwt.payload.additionalClaims.nonce) {
          throw new CredoError(`JWT payload 'nonce' does not match challenge '${options.challenge}'`)
        }

        const audArray = asArray(presentation.jwt.payload.aud)
        if (options.domain && !audArray.includes(options.domain)) {
          throw new CredoError(`JWT payload 'aud' does not include domain '${options.domain}'`)
        }

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

      let signatureResult: VerifyJwsResult | undefined = undefined
      try {
        // Verify the JWS signature
        signatureResult = await this.jwsService.verifyJws(agentContext, {
          jws: presentation.jwt.serializedJwt,
          allowedJwsSignerMethods: ['did'],
          jwsSigner: {
            method: 'did',
            didUrl: proverVerificationMethod.id,
            jwk: proverPublicKey,
          },
          trustedCertificates: [],
        })

        if (!signatureResult.isValid) {
          validationResults.validations.presentationSignature = {
            isValid: false,
            error: new CredoError('Invalid JWS signature on presentation'),
          }
        } else {
          validationResults.validations.presentationSignature = {
            isValid: true,
          }
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
          if (!(credential.envelopedCredential instanceof W3cV2JwtVerifiableCredential)) {
            return {
              isValid: false,
              error: new CredoError(
                'Credential is not of format JWT. Presentations in JWT format can only contain credentials in JWT format.'
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
}
