import type { AgentContext } from '../../../agent/context'
import { JwsService, JwtPayload } from '../../../crypto'
import type { VerifyJwsResult } from '../../../crypto/JwsService'
import { CredoError } from '../../../error'
import { injectable } from '../../../plugins'
import { JsonTransformer, MessageValidator, asArray, isDid } from '../../../utils'
import type { DidPurpose, VerificationMethod } from '../../dids'
import { DidResolverService, DidsApi, parseDid } from '../../dids'
import {
  getPublicJwkFromVerificationMethod,
  getSupportedVerificationMethodTypesForPublicJwk,
} from '../../dids/domain/key-type/keyDidMapping'
import { KnownJwaSignatureAlgorithm, PublicJwk } from '../../kms'
import type {
  W3cV2JwtSignCredentialOptions,
  W3cV2JwtSignPresentationOptions,
  W3cV2JwtVerifyCredentialOptions,
  W3cV2JwtVerifyPresentationOptions,
} from '../W3cV2CredentialServiceOptions'
import type { SingleValidationResult, W3cV2VerifyCredentialResult, W3cV2VerifyPresentationResult } from '../models'
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

    if (!isDid(options.verificationMethod)) {
      throw new CredoError('Only did identifiers are supported as verification method')
    }

    const publicJwk = await this.resolveVerificationMethod(agentContext, options.verificationMethod, [
      'assertionMethod',
    ])

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

      const issuerVerificationMethod = await this.getVerificationMethodForJwtCredential(agentContext, {
        credential,
        purpose: ['assertionMethod'],
      })
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

    // Set the nonce so it's included in the signature
    jwtPayload.additionalClaims.nonce = options.challenge
    jwtPayload.aud = options.domain

    const publicJwk = await this.resolveVerificationMethod(agentContext, options.verificationMethod, ['authentication'])

    const jwt = await this.jwsService.createJwsCompact(agentContext, {
      payload: jwtPayload,
      keyId: publicJwk.keyId,
      protectedHeaderOptions: {
        typ: 'vp+jwt',
        alg: options.alg,
        kid: options.verificationMethod,
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

      const proverVerificationMethod = await this.getVerificationMethodForJwtCredential(agentContext, {
        credential: presentation,
        purpose: ['authentication'],
      })
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

  private async resolveVerificationMethod(
    agentContext: AgentContext,
    verificationMethod: string,
    allowsPurposes?: DidPurpose[]
  ): Promise<PublicJwk> {
    const dids = agentContext.resolve(DidsApi)

    const parsedDid = parseDid(verificationMethod)
    const { didDocument, keys } = await dids.resolveCreatedDidDocumentWithKeys(parsedDid.did)
    const verificationMethodObject = didDocument.dereferenceKey(verificationMethod, allowsPurposes)
    const publicJwk = getPublicJwkFromVerificationMethod(verificationMethodObject)

    publicJwk.keyId =
      keys?.find(({ didDocumentRelativeKeyId }) => verificationMethodObject.id.endsWith(didDocumentRelativeKeyId))
        ?.kmsKeyId ?? publicJwk.legacyKeyId

    return publicJwk
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
      credential: W3cV2JwtVerifiableCredential | W3cV2JwtVerifiablePresentation
      purpose?: DidPurpose[]
    }
  ) {
    const { credential, purpose } = options
    const kid = credential.jwt.header.kid

    const didResolver = agentContext.dependencyManager.resolve(DidResolverService)

    // The signerId is the `holder` of the presentation or the `issuer` of the credential
    // For a credential only the `iss` COULD be enough to resolve the signer key (see method comments)
    const signerId = credential.jwt.payload.iss

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
        credential.jwt.header.alg as KnownJwaSignatureAlgorithm
      )
      const supportedVerificationMethodTypes = getSupportedVerificationMethodTypesForPublicJwk(jwkClass)

      const didDocument = await didResolver.resolveDidDocument(agentContext, signerId)
      const verificationMethods =
        didDocument.assertionMethod
          ?.map((v) => (typeof v === 'string' ? didDocument.dereferenceVerificationMethod(v) : v))
          .filter((v) => supportedVerificationMethodTypes.includes(v.type)) ?? []

      if (verificationMethods.length === 0) {
        throw new CredoError(
          `No verification methods found for signer '${signerId}' and key type '${jwkClass.name}' for alg '${credential.jwt.header.alg}'. Unable to determine which public key is associated with the credential.`
        )
      }
      if (verificationMethods.length > 1) {
        throw new CredoError(
          `Multiple verification methods found for signer '${signerId}' and key type '${jwkClass.name}' for alg '${credential.jwt.header.alg}'. Unable to determine which public key is associated with the credential.`
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
}
