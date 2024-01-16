import type {
  AuthorizationCodeFlowConfig,
  CreateCredentialOfferOptions,
  CreateCredentialResponseOptions,
  CreateIssuerOptions,
  CredentialOffer,
  IssuerMetadata,
  OpenId4VciSignCredential,
  OpenId4VciSignSdJwtCredential,
  OpenId4VciSignW3cCredential,
  PreAuthorizedCodeFlowConfig,
} from './OpenId4VcIssuerServiceOptions'
import type { ReferencedOfferedCredentialWithMetadata } from '../openid4vc-holder/reception/utils/IssuerMetadataUtils'
import type { CredentialHolderBinding } from '../shared'
import type { AgentContext, DidDocument } from '@aries-framework/core'
import type { SdJwtVcModule } from '@aries-framework/sd-jwt-vc'
import type {
  CredentialOfferPayloadV1_0_11,
  CredentialRequestV1_0_11,
  Grant,
  JWTVerifyCallback,
  CredentialSupported,
} from '@sphereon/oid4vci-common'
import type {
  CredentialDataSupplier,
  CredentialDataSupplierArgs,
  CredentialIssuanceInput,
  CredentialSignerCallback,
} from '@sphereon/oid4vci-issuer'
import type { ICredential } from '@sphereon/ssi-types'

import {
  ClaimFormat,
  JsonEncoder,
  getJwkFromJson,
  KeyType,
  utils,
  AriesFrameworkError,
  DidsApi,
  JsonTransformer,
  JwsService,
  Jwt,
  W3cCredential,
  W3cCredentialService,
  equalsIgnoreOrder,
  getApiForModuleByName,
  getJwkFromKey,
  getKeyFromVerificationMethod,
  injectable,
  joinUriParts,
} from '@aries-framework/core'
import { IssueStatus } from '@sphereon/oid4vci-common'
import { VcIssuerBuilder } from '@sphereon/oid4vci-issuer'

import { OpenId4VciCredentialFormatProfile } from '../openid4vc-holder'
import {
  OfferedCredentialType,
  getOfferedCredentialsWithMetadata,
} from '../openid4vc-holder/reception/utils/IssuerMetadataUtils'
import { getSphereonW3cVerifiableCredential } from '../shared/transform'
import { getProofTypeFromKey } from '../shared/utils'

import { OpenId4VcIssuerModuleConfig } from './OpenId4VcIssuerModuleConfig'
import { OpenId4VcIssuerRecord } from './repository/OpenId4VcIssuerRecord'
import { OpenId4VcIssuerRepository } from './repository/OpenId4VcIssuerRepository'
import { storeIssuerIdForContextCorrelationId } from './router/requestContext'

const w3cOpenId4VcFormats = [
  OpenId4VciCredentialFormatProfile.JwtVcJson,
  OpenId4VciCredentialFormatProfile.JwtVcJsonLd,
  OpenId4VciCredentialFormatProfile.LdpVc,
]

/**
 * @internal
 */
@injectable()
export class OpenId4VcIssuerService {
  private w3cCredentialService: W3cCredentialService
  private jwsService: JwsService
  private openId4VcIssuerConfig: OpenId4VcIssuerModuleConfig
  private openId4VcIssuerRepository: OpenId4VcIssuerRepository

  public constructor(
    w3cCredentialService: W3cCredentialService,
    jwsService: JwsService,
    openId4VcIssuerConfig: OpenId4VcIssuerModuleConfig,
    openId4VcIssuerRepository: OpenId4VcIssuerRepository
  ) {
    this.w3cCredentialService = w3cCredentialService
    this.jwsService = jwsService
    this.openId4VcIssuerConfig = openId4VcIssuerConfig
    this.openId4VcIssuerRepository = openId4VcIssuerRepository
  }

  public getIssuerMetadata(agentContext: AgentContext, issuerRecord: OpenId4VcIssuerRecord): IssuerMetadata {
    const config = agentContext.dependencyManager.resolve(OpenId4VcIssuerModuleConfig)
    const issuerUrl = joinUriParts(config.baseUrl, [issuerRecord.issuerId])
    const issuerMetadata = {
      issuerUrl,
      tokenEndpoint: joinUriParts(issuerUrl, [config.accessTokenEndpoint.endpointPath]),
      credentialEndpoint: joinUriParts(issuerUrl, [config.credentialEndpoint.endpointPath]),
      credentialsSupported: issuerRecord.credentialsSupported,
      issuerDisplay: issuerRecord.display,
    } satisfies IssuerMetadata

    return issuerMetadata
  }

  public async createCredentialOffer(
    agentContext: AgentContext,
    options: CreateCredentialOfferOptions & { issuer: OpenId4VcIssuerRecord }
  ): Promise<CredentialOffer> {
    const { preAuthorizedCodeFlowConfig, authorizationCodeFlowConfig, issuer, offeredCredentials } = options

    const vcIssuer = this.getVcIssuer(agentContext, issuer)

    // this checks if the structure of the credentials is correct
    // it throws an error if a offered credential cannot be found in the credentialsSupported
    getOfferedCredentialsWithMetadata(offeredCredentials, vcIssuer.issuerMetadata.credentials_supported)

    const { uri, session } = await vcIssuer.createCredentialOfferURI({
      grants: await this.getGrantsFromConfig(agentContext, preAuthorizedCodeFlowConfig, authorizationCodeFlowConfig),
      credentials: offeredCredentials,
      credentialOfferUri: options.credentialOfferUri,
      scheme: options.scheme ?? 'https',
      baseUri: options.baseUri,
    })

    return {
      credentialOfferPayload: session.credentialOffer.credential_offer,
      credentialOfferUri: uri,
    }
  }

  public async getCredentialOfferFromUri(agentContext: AgentContext, uri: string) {
    const { credentialOfferSessionId, credentialOfferSession } = await this.getCredentialOfferSessionFromUri(
      agentContext,
      uri
    )

    credentialOfferSession.lastUpdatedAt = +new Date()
    credentialOfferSession.status = IssueStatus.OFFER_URI_RETRIEVED
    await this.openId4VcIssuerConfig
      .getCredentialOfferSessionStateManager(agentContext)
      .set(credentialOfferSessionId, credentialOfferSession)

    return credentialOfferSession.credentialOffer.credential_offer
  }

  public async createCredentialResponse(
    agentContext: AgentContext,
    options: CreateCredentialResponseOptions & { issuer: OpenId4VcIssuerRecord }
  ) {
    const { credentialRequest, issuer } = options
    if (!credentialRequest.proof) throw new AriesFrameworkError('No proof defined in the credentialRequest.')

    const vcIssuer = this.getVcIssuer(agentContext, issuer)
    const issueCredentialResponse = await vcIssuer.issueCredential({
      credentialRequest,
      // FIXME: move this to top-level config (or at least not endpoint config)
      tokenExpiresIn: this.openId4VcIssuerConfig.accessTokenEndpoint.tokenExpiresInSeconds,

      // This can just be combined with signing callback right?
      credentialDataSupplier: this.getCredentialDataSupplier(agentContext, options),
      newCNonce: undefined,
      responseCNonce: undefined,
    })

    if (!issueCredentialResponse.credential) {
      throw new AriesFrameworkError('No credential found in the issueCredentialResponse.')
    }

    if (issueCredentialResponse.acceptance_token) {
      throw new AriesFrameworkError('Acceptance token not yet supported.')
    }

    return issueCredentialResponse
  }

  public async getAllIssuers(agentContext: AgentContext) {
    return this.openId4VcIssuerRepository.getAll(agentContext)
  }

  public async getByIssuerId(agentContext: AgentContext, issuerId: string) {
    return this.openId4VcIssuerRepository.getByIssuerId(agentContext, issuerId)
  }

  public async updateIssuer(agentContext: AgentContext, issuer: OpenId4VcIssuerRecord) {
    return this.openId4VcIssuerRepository.update(agentContext, issuer)
  }

  public async createIssuer(agentContext: AgentContext, options: CreateIssuerOptions) {
    // TODO: ideally we can store additional data with a key, such as:
    // - createdAt
    // - purpose
    const accessTokenSignerKey = await agentContext.wallet.createKey({
      keyType: KeyType.Ed25519,
    })
    const openId4VcIssuer = new OpenId4VcIssuerRecord({
      issuerId: utils.uuid(),
      display: options.display,
      accessTokenPublicKeyFingerprint: accessTokenSignerKey.fingerprint,
      credentialsSupported: options.credentialsSupported,
    })

    await this.openId4VcIssuerRepository.save(agentContext, openId4VcIssuer)
    await storeIssuerIdForContextCorrelationId(agentContext, openId4VcIssuer.issuerId)
    return openId4VcIssuer
  }

  public async rotateAccessTokenSigningKey(agentContext: AgentContext, issuer: OpenId4VcIssuerRecord) {
    const accessTokenSignerKey = await agentContext.wallet.createKey({
      keyType: KeyType.Ed25519,
    })

    // TODO: ideally we can remove the previous key
    issuer.accessTokenPublicKeyFingerprint = accessTokenSignerKey.fingerprint
    await this.openId4VcIssuerRepository.update(agentContext, issuer)
  }

  private async getCredentialOfferSessionFromUri(agentContext: AgentContext, uri: string) {
    const uriState = await this.openId4VcIssuerConfig.getUriStateManager(agentContext).get(uri)
    if (!uriState) throw new AriesFrameworkError(`Credential offer uri '${uri}' not found.`)

    const credentialOfferSessionId = uriState.preAuthorizedCode ?? uriState.issuerState
    if (!credentialOfferSessionId) {
      throw new AriesFrameworkError(
        `Credential offer uri '${uri}' is not associated with a preAuthorizedCode or issuerState.`
      )
    }

    const credentialOfferSession = await this.openId4VcIssuerConfig
      .getCredentialOfferSessionStateManager(agentContext)
      .get(credentialOfferSessionId)
    if (!credentialOfferSession)
      throw new AriesFrameworkError(
        `Credential offer session for '${uri}' with id '${credentialOfferSessionId}' not found.`
      )

    return { credentialOfferSessionId, credentialOfferSession }
  }

  private getJwtVerifyCallback = (agentContext: AgentContext): JWTVerifyCallback<DidDocument> => {
    return async (opts) => {
      let didDocument = undefined as DidDocument | undefined
      const { isValid, jws } = await this.jwsService.verifyJws(agentContext, {
        jws: opts.jwt,
        // Only handles kid as did resolution. JWK is handled by jws service
        jwkResolver: async ({ protectedHeader: { kid } }) => {
          if (!kid) throw new AriesFrameworkError('Missing kid in protected header.')
          if (!kid.startsWith('did:')) throw new AriesFrameworkError('Only did is supported for kid identifier')

          const didsApi = agentContext.dependencyManager.resolve(DidsApi)
          didDocument = await didsApi.resolveDidDocument(kid)
          const verificationMethod = didDocument.dereferenceKey(kid, ['authentication', 'assertionMethod'])
          const key = getKeyFromVerificationMethod(verificationMethod)
          return getJwkFromKey(key)
        },
      })

      if (!isValid) throw new AriesFrameworkError('Could not verify JWT signature.')

      // FIXME: the jws service should return some better decoded metadata also from the resolver
      // as currently is less useful if you afterwards need properties from the JWS
      const firstJws = jws.signatures[0]
      const protectedHeader = JsonEncoder.fromBase64(firstJws.protected)
      return {
        jwt: { header: protectedHeader, payload: JsonEncoder.fromBase64(jws.payload) },
        kid: protectedHeader.kid,
        jwk: protectedHeader.jwk ? getJwkFromJson(protectedHeader.jwk) : undefined,
        did: didDocument?.id,
        alg: protectedHeader.alg,
        didDocument,
      }
    }
  }

  private getVcIssuer(agentContext: AgentContext, issuer: OpenId4VcIssuerRecord) {
    const issuerMetadata = this.getIssuerMetadata(agentContext, issuer)

    const builder = new VcIssuerBuilder()
      .withCredentialIssuer(issuerMetadata.issuerUrl)
      .withCredentialEndpoint(issuerMetadata.credentialEndpoint)
      .withTokenEndpoint(issuerMetadata.tokenEndpoint)
      .withCredentialsSupported(issuerMetadata.credentialsSupported)
      // FIXME: need to create persistent state managers
      .withCNonceStateManager(this.openId4VcIssuerConfig.getCNonceStateManager(agentContext))
      .withCredentialOfferStateManager(this.openId4VcIssuerConfig.getCredentialOfferSessionStateManager(agentContext))
      .withCredentialOfferURIStateManager(this.openId4VcIssuerConfig.getUriStateManager(agentContext))
      .withJWTVerifyCallback(this.getJwtVerifyCallback(agentContext))
      .withCredentialSignerCallback(() => {
        throw new AriesFrameworkError('Credential signer callback should be overwritten. This is a no-op')
      })

    if (issuerMetadata.authorizationServer) {
      builder.withAuthorizationServer(issuerMetadata.authorizationServer)
    }

    if (issuerMetadata.issuerDisplay) {
      builder.withIssuerDisplay(issuerMetadata.issuerDisplay)
    }

    return builder.build()
  }

  private async getGrantsFromConfig(
    agentContext: AgentContext,
    preAuthorizedCodeFlowConfig?: PreAuthorizedCodeFlowConfig,
    authorizationCodeFlowConfig?: AuthorizationCodeFlowConfig
  ) {
    if (!preAuthorizedCodeFlowConfig && !authorizationCodeFlowConfig) {
      throw new AriesFrameworkError(
        `Either preAuthorizedCodeFlowConfig or authorizationCodeFlowConfig must be provided.`
      )
    }

    const grants: Grant = {
      'urn:ietf:params:oauth:grant-type:pre-authorized_code': preAuthorizedCodeFlowConfig && {
        'pre-authorized_code':
          preAuthorizedCodeFlowConfig.preAuthorizedCode ?? (await agentContext.wallet.generateNonce()),
        user_pin_required: preAuthorizedCodeFlowConfig.userPinRequired ?? false,
      },

      authorization_code: authorizationCodeFlowConfig && {
        issuer_state: authorizationCodeFlowConfig.issuerState ?? (await agentContext.wallet.generateNonce()),
      },
    }

    return grants
  }

  private findOfferedCredentialsMatchingRequest(
    credentialOffer: CredentialOfferPayloadV1_0_11,
    credentialRequest: CredentialRequestV1_0_11,
    credentialsSupported: CredentialSupported[]
  ): ReferencedOfferedCredentialWithMetadata[] {
    const offeredCredentials = getOfferedCredentialsWithMetadata(credentialOffer.credentials, credentialsSupported)

    // NOTE: we only support referenced offered credentials
    // Filter out inline offers (should not be present in the first case as we don't support them at issuance)
    const referencedOfferedCredentials = offeredCredentials.filter(
      (offeredCredential): offeredCredential is ReferencedOfferedCredentialWithMetadata =>
        offeredCredential.offerType === OfferedCredentialType.CredentialSupported
    )

    return referencedOfferedCredentials.filter((offeredCredential) => {
      if (offeredCredential.format !== credentialRequest.format) return false

      if (credentialRequest.format === OpenId4VciCredentialFormatProfile.JwtVcJson) {
        return equalsIgnoreOrder(offeredCredential.types, credentialRequest.types)
      } else if (
        credentialRequest.format === OpenId4VciCredentialFormatProfile.JwtVcJsonLd ||
        credentialRequest.format === OpenId4VciCredentialFormatProfile.LdpVc
      ) {
        return equalsIgnoreOrder(offeredCredential.types, credentialRequest.credential_definition.types)
      } else if (credentialRequest.format === OpenId4VciCredentialFormatProfile.SdJwtVc) {
        return equalsIgnoreOrder(offeredCredential.types, [credentialRequest.vct])
      }
    })
  }

  private getSdJwtVcCredentialSigningCallback = (
    agentContext: AgentContext,
    options: OpenId4VciSignSdJwtCredential
  ): CredentialSignerCallback<DidDocument> => {
    return async () => {
      const sdJwtVcApi = getApiForModuleByName<SdJwtVcModule>(agentContext, 'SdJwtVcModule')
      if (!sdJwtVcApi) throw new AriesFrameworkError(`Could not find the SdJwtVcApi`)

      const { compact } = await sdJwtVcApi.sign(options)

      return compact
    }
  }

  private getW3cCredentialSigningCallback = (
    agentContext: AgentContext,
    options: OpenId4VciSignW3cCredential
  ): CredentialSignerCallback<DidDocument> => {
    return async (opts) => {
      const { jwtVerifyResult, format } = opts
      const { kid, didDocument: holderDidDocument } = jwtVerifyResult

      if (!kid) throw new AriesFrameworkError('Missing Kid. Cannot create the holder binding')
      if (!holderDidDocument) throw new AriesFrameworkError('Missing did document. Cannot create the holder binding.')
      if (!format) throw new AriesFrameworkError('Missing format. Cannot issue credential.')

      const formatMap: Record<string, ClaimFormat.JwtVc | ClaimFormat.LdpVc> = {
        [OpenId4VciCredentialFormatProfile.JwtVcJson]: ClaimFormat.JwtVc,
        [OpenId4VciCredentialFormatProfile.JwtVcJsonLd]: ClaimFormat.JwtVc,
        [OpenId4VciCredentialFormatProfile.LdpVc]: ClaimFormat.LdpVc,
      }
      const w3cServiceFormat = formatMap[format]

      // Set the binding on the first credential subject if not set yet
      // on any subject
      if (!options.credential.credentialSubjectIds.includes(holderDidDocument.id)) {
        const credentialSubject = Array.isArray(options.credential.credentialSubject)
          ? options.credential.credentialSubject[0]
          : options.credential.credentialSubject
        credentialSubject.id = holderDidDocument.id
      }

      const didsApi = agentContext.dependencyManager.resolve(DidsApi)
      const issuerDidDocument = await didsApi.resolveDidDocument(options.verificationMethod)
      const verificationMethod = issuerDidDocument.dereferenceVerificationMethod(options.verificationMethod)

      if (w3cServiceFormat === ClaimFormat.JwtVc) {
        const key = getKeyFromVerificationMethod(verificationMethod)
        const alg = getJwkFromKey(key).supportedSignatureAlgorithms[0]

        if (!alg) {
          throw new AriesFrameworkError(`No supported JWA signature algorithms for key type ${key.keyType}`)
        }

        const signed = await this.w3cCredentialService.signCredential(agentContext, {
          format: w3cServiceFormat,
          credential: options.credential,
          verificationMethod: options.verificationMethod,
          alg,
        })

        return getSphereonW3cVerifiableCredential(signed)
      } else {
        const key = getKeyFromVerificationMethod(verificationMethod)
        const proofType = getProofTypeFromKey(agentContext, key)

        const signed = await this.w3cCredentialService.signCredential(agentContext, {
          format: w3cServiceFormat,
          credential: options.credential,
          verificationMethod: options.verificationMethod,
          proofType: proofType,
        })

        return getSphereonW3cVerifiableCredential(signed)
      }
    }
  }

  private async getHolderBindingFromRequest(credentialRequest: CredentialRequestV1_0_11) {
    if (!credentialRequest.proof?.jwt) throw new AriesFrameworkError('Received a credential request without a proof')

    const jwt = Jwt.fromSerializedJwt(credentialRequest.proof.jwt)

    if (jwt.header.kid) {
      if (!jwt.header.kid.startsWith('did:')) {
        throw new AriesFrameworkError("Only did is supported for 'kid' identifier")
      } else if (!jwt.header.kid.includes('#')) {
        throw new AriesFrameworkError(
          `kid containing did MUST point to a specific key within the did document: ${jwt.header.kid}`
        )
      }

      return {
        method: 'did',
        didUrl: jwt.header.kid,
      } satisfies CredentialHolderBinding
    } else if (jwt.header.jwk) {
      return {
        method: 'jwk',
        jwk: getJwkFromJson(jwt.header.jwk),
      } satisfies CredentialHolderBinding
    } else {
      throw new AriesFrameworkError('Either kid or jwk must be present in credential request proof header')
    }
  }

  private getCredentialDataSupplier = (
    agentContext: AgentContext,
    options: CreateCredentialResponseOptions & { issuer: OpenId4VcIssuerRecord }
  ): CredentialDataSupplier => {
    return async (args: CredentialDataSupplierArgs) => {
      const { credentialRequest, credentialOffer } = args
      const issuerMetadata = this.getIssuerMetadata(agentContext, options.issuer)

      const offeredCredentialsMatchingRequest = this.findOfferedCredentialsMatchingRequest(
        credentialOffer.credential_offer,
        credentialRequest,
        issuerMetadata.credentialsSupported
      )

      if (offeredCredentialsMatchingRequest.length === 0) {
        throw new AriesFrameworkError('No offered credentials match the credential request.')
      }

      if (offeredCredentialsMatchingRequest.length > 1) {
        agentContext.config.logger.debug(
          'Multiple credentials from credentials supported matching request, picking first one.'
        )
      }

      let signOptions = options.credential
      if (!signOptions) {
        const holderBinding = await this.getHolderBindingFromRequest(credentialRequest)
        signOptions = await this.openId4VcIssuerConfig.credentialEndpoint.credentialRequestToCredentialMapper({
          agentContext,
          holderBinding,

          credentialOffer,
          credentialRequest,

          credentialsSupported: offeredCredentialsMatchingRequest.map((o) => o.credentialSupported),
        })
      }

      if (isW3cSignCredentialOptions(signOptions)) {
        if (!w3cOpenId4VcFormats.includes(credentialRequest.format as OpenId4VciCredentialFormatProfile)) {
          throw new AriesFrameworkError(
            `The credential to be issued does not match the request. Cannot issue a W3cCredential if the client expects a credential of format '${credentialRequest.format}'.`
          )
        }

        return {
          format: credentialRequest.format,
          credential: JsonTransformer.toJSON(signOptions.credential) as ICredential,
          signCallback: this.getW3cCredentialSigningCallback(agentContext, signOptions),
        }
      } else {
        if (credentialRequest.format !== OpenId4VciCredentialFormatProfile.SdJwtVc) {
          throw new AriesFrameworkError(
            `Invalid credential format. Expected '${OpenId4VciCredentialFormatProfile.SdJwtVc}', received '${credentialRequest.format}'.`
          )
        }
        if (credentialRequest.vct !== signOptions.payload.vct) {
          throw new AriesFrameworkError(
            `The types of the offered credentials do not match the types of the requested credential. Offered '${signOptions.payload.vct}' Requested '${credentialRequest.vct}'.`
          )
        }

        return {
          format: credentialRequest.format,
          // NOTE: we don't use the credential value here as we pass the credential directly to the singer
          // FIXME: oid4vci adds `sub` property, but SD-JWT uses `cnf`
          credential: { ...signOptions.payload } as unknown as CredentialIssuanceInput,
          signCallback: this.getSdJwtVcCredentialSigningCallback(agentContext, signOptions),
        }
      }
    }
  }
}

function isW3cSignCredentialOptions(credential: OpenId4VciSignCredential): credential is OpenId4VciSignW3cCredential {
  return 'credential' in credential && credential.credential instanceof W3cCredential
}
