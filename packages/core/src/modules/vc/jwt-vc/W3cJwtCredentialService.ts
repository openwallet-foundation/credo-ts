import type { AgentContext } from '../../../agent/context'
import { TrustedIssuerContext } from '../../../agent/TrustedIssuerContext'
import type { VerifyJwsResult } from '../../../crypto/JwsService'
import { JwsService } from '../../../crypto/JwsService'
import { CredoError } from '../../../error'
import { injectable } from '../../../plugins'
import { asArray, isDid, MessageValidator } from '../../../utils'
import type { DidPurpose } from '../../dids'
import { DidsApi, parseDid } from '../../dids'
import { getPublicJwkFromVerificationMethod } from '../../dids/domain/key-type/keyDidMapping'
import { type KnownJwaSignatureAlgorithm, PublicJwk } from '../../kms'
import { W3cJsonLdVerifiableCredential } from '../linked-data-proofs/models/W3cJsonLdVerifiableCredential'
import type { W3cVerifyCredentialResult, W3cVerifyPresentationResult } from '../models'
import { resolveJwtSigner, validateSignerIsExpectedParty } from '../resolveSigner'
import { validateCredentialSubjectAuthentication } from '../util'
import type {
  W3cJwtSignCredentialOptions,
  W3cJwtSignPresentationOptions,
  W3cJwtVerifyCredentialOptions,
  W3cJwtVerifyPresentationOptions,
} from '../W3cCredentialServiceOptions'
import { getJwtPayloadFromCredential } from './credentialTransformer'
import { getJwtPayloadFromPresentation } from './presentationTransformer'
import { W3cJwtVerifiableCredential } from './W3cJwtVerifiableCredential'
import { W3cJwtVerifiablePresentation } from './W3cJwtVerifiablePresentation'

/**
 * Supports signing and verification of credentials according to the [Verifiable Credential Data Model](https://www.w3.org/TR/vc-data-model)
 * using [Json Web Tokens](https://www.w3.org/TR/vc-data-model/#json-web-token).
 */
@injectable()
export class W3cJwtCredentialService {
  private jwsService: JwsService

  public constructor(jwsService: JwsService) {
    this.jwsService = jwsService
  }

  /**
   * Signs a credential
   */
  public async signCredential(
    agentContext: AgentContext,
    options: W3cJwtSignCredentialOptions
  ): Promise<W3cJwtVerifiableCredential> {
    // Validate the instance
    MessageValidator.validateSync(options.credential)

    // Get the JWT payload for the JWT based on the JWT Encoding rules form the VC-DATA-MODEL
    // https://www.w3.org/TR/vc-data-model/#jwt-encoding
    const jwtPayload = getJwtPayloadFromCredential(options.credential)

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
        typ: 'JWT',
        alg: options.alg,
        kid: options.verificationMethod,
      },
    })

    // TODO: this re-parses and validates the credential in the JWT, which is not necessary.
    // We should somehow create an instance of W3cJwtVerifiableCredential directly from the JWT
    const jwtVc = W3cJwtVerifiableCredential.fromSerializedJwt(jwt)

    return jwtVc
  }

  /**
   * Verifies the signature(s) of a credential
   *
   * @param credential the credential to be verified
   * @returns the verification result
   */
  public async verifyCredential(
    agentContext: AgentContext,
    options: W3cJwtVerifyCredentialOptions
  ): Promise<W3cVerifyCredentialResult> {
    // NOTE: this is mostly from the JSON-LD service that adds this option. Once we support
    // the same granular validation results, we can remove this and the user could just check
    // which of the validations failed. Supporting for consistency with the JSON-LD service for now.
    const verifyCredentialStatus = options.verifyCredentialStatus ?? true

    const validationResults: W3cVerifyCredentialResult = {
      isValid: false,
      validations: {},
    }

    try {
      let credential: W3cJwtVerifiableCredential
      try {
        // If instance is provided as input, we want to validate the credential (otherwise it's done in the fromSerializedJwt method below)
        if (options.credential instanceof W3cJwtVerifiableCredential) {
          MessageValidator.validateSync(options.credential.credential)
        }

        credential =
          options.credential instanceof W3cJwtVerifiableCredential
            ? options.credential
            : W3cJwtVerifiableCredential.fromSerializedJwt(options.credential)

        // Verify the JWT payload (verifies whether it's not expired, etc...)
        credential.jwt.payload.validate({
          skewSeconds: agentContext.config.validitySkewSeconds,
        })

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

      const issuer = await resolveJwtSigner(agentContext, {
        alg: credential.jwt.header.alg as KnownJwaSignatureAlgorithm,
        kid: credential.jwt.header.kid,
        iss: credential.jwt.payload.iss,
        purpose: ['assertionMethod'],
      })
      const issuerVerificationMethod = issuer.verificationMethod
      const issuerPublicKey = getPublicJwkFromVerificationMethod(issuerVerificationMethod)

      // Ensure the issuer is trusted according to the (optional) `getTrustedIssuersForVerification`
      // callback. For did-based issuers this is a no-op when no trusted issuers are configured,
      // preserving the previous "trust any valid signature" behavior. Throws when the issuer is not trusted.
      await TrustedIssuerContext.ensureTrustedCredentialSigner(
        agentContext,
        {
          signer: { method: 'did', didUrl: issuerVerificationMethod.id },
          verification: { type: 'credential', credential },
        },
        options.trustedIssuers
      )

      let signatureResult: VerifyJwsResult | undefined
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

      const isSignedByIssuerKey = signatureResult?.jwsSigners.some(
        (jwsSigner) => jwsSigner.jwk.fingerprint === issuerPublicKey.fingerprint
      )
      validationResults.validations.issuerIsSigner = isSignedByIssuerKey
        ? validateSignerIsExpectedParty(issuer, credential.issuerId, 'issuer')
        : { isValid: false, error: new CredoError('Credential is not signed by the issuer of the credential') }

      // Validate credentialStatus
      if (verifyCredentialStatus && !credential.credentialStatus) {
        validationResults.validations.credentialStatus = {
          isValid: true,
        }
      } else if (verifyCredentialStatus && credential.credentialStatus) {
        validationResults.validations.credentialStatus = {
          isValid: false,
          error: new CredoError('Verifying credential status is not supported for JWT VCs'),
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
    options: W3cJwtSignPresentationOptions
  ): Promise<W3cJwtVerifiablePresentation> {
    // Validate the instance
    MessageValidator.validateSync(options.presentation)

    // Get the JWT payload for the JWT based on the JWT Encoding rules form the VC-DATA-MODEL
    // https://www.w3.org/TR/vc-data-model/#jwt-encoding
    const jwtPayload = getJwtPayloadFromPresentation(options.presentation)

    // Set the nonce so it's included in the signature
    jwtPayload.additionalClaims.nonce = options.challenge
    jwtPayload.aud = options.domain

    const publicJwk = await this.resolveVerificationMethod(agentContext, options.verificationMethod, ['authentication'])

    const jwt = await this.jwsService.createJwsCompact(agentContext, {
      payload: jwtPayload,
      keyId: publicJwk.keyId,
      protectedHeaderOptions: {
        typ: 'JWT',
        alg: options.alg,
        kid: options.verificationMethod,
      },
    })

    // TODO: this re-parses and validates the presentation in the JWT, which is not necessary.
    // We should somehow create an instance of W3cJwtVerifiablePresentation directly from the JWT
    const jwtVp = W3cJwtVerifiablePresentation.fromSerializedJwt(jwt)

    return jwtVp
  }

  /**
   * Verifies a presentation including the credentials it includes
   *
   * @param presentation the presentation to be verified
   * @returns the verification result
   */
  public async verifyPresentation(
    agentContext: AgentContext,
    options: W3cJwtVerifyPresentationOptions
  ): Promise<W3cVerifyPresentationResult> {
    const validationResults: W3cVerifyPresentationResult = {
      isValid: false,
      validations: {},
    }

    try {
      let presentation: W3cJwtVerifiablePresentation
      try {
        // If instance is provided as input, we want to validate the presentation
        if (options.presentation instanceof W3cJwtVerifiablePresentation) {
          MessageValidator.validateSync(options.presentation.presentation)
        }

        presentation =
          options.presentation instanceof W3cJwtVerifiablePresentation
            ? options.presentation
            : W3cJwtVerifiablePresentation.fromSerializedJwt(options.presentation)

        // Verify the JWT payload (verifies whether it's not expired, etc...)
        presentation.jwt.payload.validate({
          skewSeconds: agentContext.config.validitySkewSeconds,
        })

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

      const prover = await resolveJwtSigner(agentContext, {
        alg: presentation.jwt.header.alg as KnownJwaSignatureAlgorithm,
        kid: presentation.jwt.header.kid,
        iss: presentation.jwt.payload.iss,
        purpose: ['authentication'],
      })
      const proverVerificationMethod = prover.verificationMethod
      const proverPublicKey = getPublicJwkFromVerificationMethod(proverVerificationMethod)

      let signatureResult: VerifyJwsResult | undefined
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

      validationResults.validations.holderIsSigner = validateSignerIsExpectedParty(
        prover,
        presentation.holderId,
        'holder'
      )

      // To keep things simple, we only support JWT VCs in JWT VPs for now
      const credentials = asArray(presentation.presentation.verifiableCredential)

      // Verify all credentials in parallel, and await the result
      validationResults.validations.credentials = await Promise.all(
        credentials.map(async (credential) => {
          if (credential instanceof W3cJsonLdVerifiableCredential) {
            return {
              isValid: false,
              error: new CredoError(
                'Credential is of format ldp_vc. presentations in jwt_vp format can only contain credentials in jwt_vc format'
              ),
              validations: {},
            }
          }

          const credentialResult = await this.verifyCredential(agentContext, {
            credential,
            verifyCredentialStatus: options.verifyCredentialStatus,
            trustedIssuers: options.trustedIssuers,
          })

          const credentialSubjectAuthentication = validateCredentialSubjectAuthentication(
            credential.credentialSubjectIds,
            prover.signer
          )

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
}
