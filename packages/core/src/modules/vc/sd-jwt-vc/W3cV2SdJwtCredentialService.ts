import { SDJwtInstance } from '@sd-jwt/core'
import { DisclosureFrame, SDJWTConfig, Signer } from '@sd-jwt/types'
import type { AgentContext } from '../../../agent/context'
import { CredoError } from '../../../error'
import { injectable } from '../../../plugins'
import { JsonTransformer, MessageValidator, TypedArrayEncoder, isDid, nowInSeconds } from '../../../utils'
import type { DidPurpose } from '../../dids'
import { DidResolverService, DidsApi, parseDid } from '../../dids'
import { getPublicJwkFromVerificationMethod } from '../../dids/domain/key-type/keyDidMapping'
import { KeyManagementApi, PublicJwk } from '../../kms'
import { SdJwtVcError, SdJwtVcHolderBinding } from '../../sd-jwt-vc'
import type {
  W3cV2SdJwtSignCredentialOptions,
  W3cV2SdJwtSignPresentationOptions,
  W3cV2SdJwtVerifyCredentialOptions,
  W3cV2SdJwtVerifyPresentationOptions,
} from '../W3cV2CredentialServiceOptions'
import type {
  W3cV2JsonCredential,
  W3cV2JsonPresentation,
  W3cV2VerifyCredentialResult,
  W3cV2VerifyPresentationResult,
} from '../models'
import { sdJwtVcHasher } from './W3cV2SdJwt'
import { W3cV2SdJwtVerifiableCredential } from './W3cV2SdJwtVerifiableCredential'
import { W3cV2SdJwtVerifiablePresentation } from './W3cV2SdJwtVerifiablePresentation'

/**
 * Supports signing and verifying W3C Verifiable Credentials and Presentations
 * secured with Selective Disclosure JSON Web Tokens (SD-JWT).
 *
 * @see https://www.w3.org/TR/vc-data-model/
 * @see https://www.w3.org/TR/vc-jose-cose/#with-sd-jwt
 */
@injectable()
export class W3cV2SdJwtCredentialService {
  // TODO: add disclose method to create an SD-JWT VC from an existent SD-JWT VC

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

    // holer binding is optional
    const holderBinding = options.holder
      ? await this.extractKeyFromHolderBinding(agentContext, options.holder)
      : undefined

    const sdjwt = new SDJwtInstance({
      ...this.getBaseSdJwtConfig(agentContext),
      signer: this.signer(agentContext, publicJwk),
      hashAlg: options.hashingAlgorithm ?? 'sha-256',
      signAlg: options.alg,
    })

    const compact = await sdjwt.issue<W3cV2JsonCredential>(
      {
        ...payload,
        cnf: holderBinding?.cnf,
        iss: parsedDid.did,
        iat: nowInSeconds(),
      },
      options.disclosureFrame as DisclosureFrame<W3cV2JsonCredential>,
      {
        header: {
          alg: options.alg,
          typ: 'vc+sd-jwt',
          kid: `#${parsedDid.fragment}`,
        },
      }
    )

    // TODO: this re-parses and validates the credential in the JWT, which is not necessary.
    // We should somehow create an instance of W3cV2SdJwtVerifiableCredential directly from the JWT.
    return W3cV2SdJwtVerifiableCredential.fromCompact(compact)
  }

  /**
   * Verifies the signature(s) of a credential
   *
   * @param credential the credential to be verified
   * @returns the verification result
   */
  public async verifyCredential(
    _agentContext: AgentContext,
    _options: W3cV2SdJwtVerifyCredentialOptions
  ): Promise<W3cV2VerifyCredentialResult> {
    throw new Error('Not implemented yet')
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
      signer: this.signer(agentContext, publicJwk),
      hashAlg: options.hashingAlgorithm ?? 'sha-256',
      signAlg: options.alg,
    })

    const compact = await sdjwt.issue<W3cV2JsonPresentation>(
      {
        ...payload,
        iss: parsedDid.did,
        iat: nowInSeconds(),
        nonce: options.challenge,
        aud: options.domain,
      },
      options.disclosureFrame as DisclosureFrame<W3cV2JsonPresentation>,
      {
        header: {
          alg: options.alg,
          typ: 'vc+sd-jwt',
          kid: `#${parsedDid.fragment}`,
        },
      }
    )

    // TODO: this re-parses and validates the presentation in the JWT, which is not necessary.
    // We should somehow create an instance of W3cV2SdJwtVerifiablePresentation directly from the JWT
    return W3cV2SdJwtVerifiablePresentation.fromCompact(compact)
  }

  /**
   * Verifies a presentation including the credentials it includes
   *
   * @param presentation the presentation to be verified
   * @returns the verification result
   */
  public async verifyPresentation(
    _agentContext: AgentContext,
    _options: W3cV2SdJwtVerifyPresentationOptions
  ): Promise<W3cV2VerifyPresentationResult> {
    throw new Error('Not implemented yet')
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

  // TODO: methods from SdJwtVcService. Maybe de-duplicate?

  private async resolveSigningPublicJwkFromDidUrl(agentContext: AgentContext, didUrl: string) {
    const dids = agentContext.dependencyManager.resolve(DidsApi)

    const { publicJwk } = await dids.resolveVerificationMethodFromCreatedDidRecord(didUrl)
    return publicJwk
  }

  private async resolveDidUrl(agentContext: AgentContext, didUrl: string) {
    const didResolver = agentContext.dependencyManager.resolve(DidResolverService)
    const didDocument = await didResolver.resolveDidDocument(agentContext, didUrl)

    return {
      verificationMethod: didDocument.dereferenceKey(didUrl, ['assertionMethod']),
      didDocument,
    }
  }

  private async extractKeyFromHolderBinding(
    agentContext: AgentContext,
    holder: SdJwtVcHolderBinding,
    forSigning = false
  ) {
    if (holder.method === 'did') {
      const parsedDid = parseDid(holder.didUrl)
      if (!parsedDid.fragment) {
        throw new SdJwtVcError(
          `didUrl '${holder.didUrl}' does not contain a '#'. Unable to derive key from did document`
        )
      }

      let publicJwk: PublicJwk
      if (forSigning) {
        publicJwk = await this.resolveSigningPublicJwkFromDidUrl(agentContext, holder.didUrl)
      } else {
        const { verificationMethod } = await this.resolveDidUrl(agentContext, holder.didUrl)
        publicJwk = getPublicJwkFromVerificationMethod(verificationMethod)
      }

      const supportedSignatureAlgorithms = publicJwk.supportedSignatureAlgorithms
      if (supportedSignatureAlgorithms.length === 0) {
        throw new SdJwtVcError(
          `No supported JWA signature algorithms found for key ${publicJwk.jwkTypehumanDescription}`
        )
      }
      const alg = supportedSignatureAlgorithms[0]

      return {
        alg,
        publicJwk,
        cnf: {
          // We need to include the whole didUrl here, otherwise the verifier
          // won't know which did it is associated with
          kid: holder.didUrl,
        },
      }
    }
    if (holder.method === 'jwk') {
      const publicJwk = holder.jwk
      const alg = publicJwk.supportedSignatureAlgorithms[0]

      // If there is no key id configured when signing, we assume this credential was issued before we included key ids
      // and the we use the legacy key id.
      if (forSigning && !publicJwk.hasKeyId) {
        publicJwk.keyId = publicJwk.legacyKeyId
      }

      return {
        alg,
        publicJwk,
        cnf: {
          jwk: publicJwk.toJson(),
        },
      }
    }

    throw new SdJwtVcError("Unsupported credential holder binding. Only 'did' and 'jwk' are supported at the moment.")
  }

  private getBaseSdJwtConfig(agentContext: AgentContext): SDJWTConfig {
    const kms = agentContext.resolve(KeyManagementApi)

    return {
      hasher: sdJwtVcHasher,
      saltGenerator: (length) => TypedArrayEncoder.toBase64URL(kms.randomBytes({ length })).slice(0, length),
    }
  }

  /**
   * @todo validate the JWT header (alg)
   */
  private signer(agentContext: AgentContext, key: PublicJwk): Signer {
    const kms = agentContext.resolve(KeyManagementApi)

    return async (input: string) => {
      const result = await kms.sign({
        keyId: key.keyId,
        data: TypedArrayEncoder.fromString(input),
        algorithm: key.signatureAlgorithm,
      })

      return TypedArrayEncoder.toBase64URL(result.signature)
    }
  }
}
