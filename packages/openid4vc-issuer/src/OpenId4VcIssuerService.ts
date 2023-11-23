import type {
  CreateCredentialOfferAndRequestOptions,
  AuthorizationCodeFlowConfig,
  PreAuthorizedCodeFlowConfig,
  OfferedCredential,
  CreateIssueCredentialResponseOptions,
  CredentialSupported,
  CredentialOfferAndRequest,
  EndpointConfig,
} from './OpenId4VcIssuerServiceOptions'
import type {
  AgentContext,
  VerificationMethod,
  W3cVerifiableCredential,
  DidDocument,
  JwaSignatureAlgorithm,
} from '@aries-framework/core'
import type {
  CredentialRequestJwtVc,
  CredentialRequestLdpVc,
  Grant,
  MetadataDisplay,
  JWTVerifyCallback,
  CredentialOfferFormat,
  CredentialRequestV1_0_11,
  CredentialOfferPayloadV1_0_11,
  CredentialSupported as SphereonCredentialSupported,
} from '@sphereon/oid4vci-common'
import type {
  CredentialDataSupplier,
  CredentialDataSupplierArgs,
  CredentialSignerCallback,
} from '@sphereon/oid4vci-issuer'
import type { ICredential, W3CVerifiableCredential as SphereonW3cVerifiableCredential } from '@sphereon/ssi-types'
import type { Router } from 'express'

import {
  AriesFrameworkError,
  ClaimFormat,
  InjectionSymbols,
  JwsService,
  Logger,
  W3cCredentialService,
  inject,
  injectable,
  JsonTransformer,
  W3cCredential,
  Jwt,
  SignatureSuiteRegistry,
  DidsApi,
  getKeyFromVerificationMethod,
  getJwkFromKey,
  equalsIgnoreOrder,
} from '@aries-framework/core'
import { IssueStatus } from '@sphereon/oid4vci-common'
import { VcIssuerBuilder } from '@sphereon/oid4vci-issuer'
import bodyParser from 'body-parser'

import { OpenId4VcIssuerModuleConfig } from './OpenId4VcIssuerModuleConfig'
import {
  configureAccessTokenEndpoint,
  configureCredentialEndpoint,
  configureIssuerMetadataEndpoint,
} from './router/OpenId4VcIEndpointConfiguration'

// TODO: duplicate
function getSphereonW3cVerifiableCredential(
  w3cVerifiableCredential: W3cVerifiableCredential
): SphereonW3cVerifiableCredential {
  if (w3cVerifiableCredential.claimFormat === ClaimFormat.LdpVc) {
    return JsonTransformer.toJSON(w3cVerifiableCredential) as SphereonW3cVerifiableCredential
  } else if (w3cVerifiableCredential.claimFormat === ClaimFormat.JwtVc) {
    return w3cVerifiableCredential.serializedJwt
  } else {
    throw new AriesFrameworkError(
      `Unsupported claim format. Only ${ClaimFormat.LdpVc} and ${ClaimFormat.JwtVc} are supported.`
    )
  }
}

/**
 * @internal
 */
@injectable()
export class OpenId4VcIssuerService {
  private logger: Logger
  private w3cCredentialService: W3cCredentialService
  private jwsService: JwsService
  private openId4VcIssuerModuleConfig: OpenId4VcIssuerModuleConfig

  public get issuerMetadata() {
    return this.openId4VcIssuerModuleConfig.issuerMetadata
  }

  public get cNonceStateManager() {
    return this.openId4VcIssuerModuleConfig.cNonceStateManager
  }

  public get credentialOfferSessionManager() {
    return this.openId4VcIssuerModuleConfig.credentialOfferSessionManager
  }

  public get uriStateManager() {
    return this.openId4VcIssuerModuleConfig.uriStateManager
  }

  public constructor(
    @inject(InjectionSymbols.Logger) logger: Logger,
    openId4VcIssuerModuleConfig: OpenId4VcIssuerModuleConfig,
    w3cCredentialService: W3cCredentialService,
    jwsService: JwsService
  ) {
    this.w3cCredentialService = w3cCredentialService
    this.logger = logger
    this.openId4VcIssuerModuleConfig = openId4VcIssuerModuleConfig
    this.jwsService = jwsService
  }

  private getProofTypeForLdpVc(agentContext: AgentContext, verificationMethod: VerificationMethod) {
    const signatureSuiteRegistry = agentContext.dependencyManager.resolve(SignatureSuiteRegistry)

    const supportedSignatureSuite = signatureSuiteRegistry.getByVerificationMethodType(verificationMethod.type)
    if (!supportedSignatureSuite) {
      throw new AriesFrameworkError(
        `Couldn't find a supported signature suite for the given verification method type '${verificationMethod.type}'.`
      )
    }

    return supportedSignatureSuite.proofType
  }

  private getJwtVerifyCallback = (agentContext: AgentContext): JWTVerifyCallback<DidDocument> => {
    return async (opts) => {
      const { jwt } = opts

      const { header, payload } = Jwt.fromSerializedJwt(jwt)
      const { alg, kid } = header

      // kid: JOSE Header containing the key ID. If the Credential shall be bound to a DID,
      // the kid refers to a DID URL which identifies a particular key in the DID Document that
      // the Credential shall be bound to. MUST NOT be present if jwk or x5c is present.
      if (!kid) throw new AriesFrameworkError('No KID is present for verifying the proof of possession.')

      const didsApi = agentContext.dependencyManager.resolve(DidsApi)
      const didDocument = await didsApi.resolveDidDocument(kid)
      const verificationMethod = didDocument.dereferenceKey(kid, ['authentication', 'assertionMethod'])
      const key = getKeyFromVerificationMethod(verificationMethod)
      const jwk = getJwkFromKey(key)

      if (!jwk.supportsSignatureAlgorithm(alg)) {
        throw new AriesFrameworkError(
          `The signature algorithm '${alg}' is not supported by keys of type '${jwk.keyType}'.`
        )
      }

      const { isValid } = await this.jwsService.verifyJws(agentContext, {
        jws: jwt,
        jwkResolver: () => jwk,
      })

      if (!isValid) throw new AriesFrameworkError('Could not verify JWT signature.')

      return {
        jwt: { header, payload: payload.toJson() },
        kid,
        did: didDocument.id,
        alg,
        didDocument,
      }
    }
  }

  private getCredentialSigningCallback = (
    agentContext: AgentContext,
    issuerVerificationMethod: VerificationMethod
  ): CredentialSignerCallback<DidDocument> => {
    return async (opts) => {
      const { credential, jwtVerifyResult, format } = opts

      const { alg, kid, didDocument: holderDidDocument } = jwtVerifyResult

      if (!kid) throw new AriesFrameworkError('No KID present for binding the credential to a holder.')
      if (!holderDidDocument) {
        throw new AriesFrameworkError('No DID document present for binding the credential to a holder.')
      }

      // If the Credential shall be bound to a DID, the kid refers to a DID URL which identifies a
      // particular key in the DID Document that the Credential shall be bound to.
      const holderVerificationMethod = holderDidDocument.dereferenceKey(kid, ['assertionMethod'])

      let signed: W3cVerifiableCredential<ClaimFormat.JwtVc | ClaimFormat.LdpVc>
      if (format === 'jwt_vc_json' || format === 'jwt_vc_json-ld') {
        signed = await this.w3cCredentialService.signCredential(agentContext, {
          format: ClaimFormat.JwtVc,
          credential: W3cCredential.fromJson(credential),
          verificationMethod: issuerVerificationMethod.id,
          alg: alg as JwaSignatureAlgorithm,
        })
      } else {
        signed = await this.w3cCredentialService.signCredential(agentContext, {
          format: ClaimFormat.LdpVc,
          credential: W3cCredential.fromJson(credential),
          verificationMethod: issuerVerificationMethod.id,
          proofPurpose: 'assertionMethod',
          proofType: this.getProofTypeForLdpVc(agentContext, holderVerificationMethod),
        })
      }

      return getSphereonW3cVerifiableCredential(signed)
    }
  }

  private getVcIssuer(
    agentContext: AgentContext,
    options: {
      credentialIssuer: string
      credentialEndpoint: string
      tokenEndpoint: string
      credentialsSupported: CredentialSupported[]
      authorizationServer?: string
      issuerDisplay?: MetadataDisplay | MetadataDisplay[]
    }
  ) {
    const { credentialIssuer, tokenEndpoint, credentialEndpoint, credentialsSupported } = options
    const builder = new VcIssuerBuilder()
      .withCredentialIssuer(credentialIssuer)
      .withCredentialEndpoint(credentialEndpoint)
      .withTokenEndpoint(tokenEndpoint)
      // FIXME: currently credentialsSupported is not typed correctly
      .withCredentialsSupported(credentialsSupported as SphereonCredentialSupported[])
      .withCNonceExpiresIn(this.openId4VcIssuerModuleConfig.cNonceExpiresIn)
      .withCNonceStateManager(this.cNonceStateManager)
      .withCredentialOfferStateManager(this.credentialOfferSessionManager)
      .withCredentialOfferURIStateManager(this.uriStateManager)
      .withJWTVerifyCallback(this.getJwtVerifyCallback(agentContext))
      .withCredentialSignerCallback(() => {
        throw new AriesFrameworkError('this should never ba called')
      })

    if (options.authorizationServer) {
      builder.withAuthorizationServer(options.authorizationServer)
    }

    if (options.issuerDisplay) {
      builder.withIssuerDisplay(options.issuerDisplay)
    }

    return builder.build()
  }

  private getGrantsFromConfig(
    preAuthorizedCodeFlowConfig?: PreAuthorizedCodeFlowConfig,
    authorizationCodeFlowConfig?: AuthorizationCodeFlowConfig
  ) {
    if (!preAuthorizedCodeFlowConfig && !authorizationCodeFlowConfig) {
      throw new AriesFrameworkError(
        `Either preAuthorizedCodeFlowConfig or authorizationCodeFlowConfig must be provided.`
      )
    }

    let grants: Grant = {}
    if (preAuthorizedCodeFlowConfig) {
      grants = {
        ...grants,
        'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
          /**
           * REQUIRED. The code representing the Credential Issuer's authorization for the Wallet to obtain Credentials of a certain type.
           */
          'pre-authorized_code': preAuthorizedCodeFlowConfig.preAuthorizedCode,
          /**
           * OPTIONAL. Boolean value specifying whether the Credential Issuer expects presentation of a user PIN along with the Token Request
           * in a Pre-Authorized Code Flow. Default is false.
           */
          user_pin_required: preAuthorizedCodeFlowConfig.userPinRequired ?? false,
        },
      }
    }

    if (authorizationCodeFlowConfig) {
      grants = {
        ...grants,
        authorization_code: { issuer_state: authorizationCodeFlowConfig.issuerState },
      }
    }

    return grants
  }

  private mapInlineCredentialOfferIdToCredentialSupported(id: string, credentialsSupported: CredentialSupported[]) {
    const credentialSupported = credentialsSupported.find((cs) => cs.id === id)
    if (!credentialSupported) throw new AriesFrameworkError(`Credential supported with id '${id}' not found.`)

    return credentialSupported
  }

  private getCredentialMetadata(
    credential: CredentialSupported | CredentialOfferFormat
  ): CredentialRequestJwtVc | CredentialRequestLdpVc {
    if (credential.format === 'jwt_vc_json' || credential.format === 'jwt_vc_json-ld') {
      return {
        format: credential.format,
        types: credential.types,
      }
    } else {
      // TODO:
      throw new AriesFrameworkError('Unsupported credential format')
    }
  }

  private getOfferedCredentialsMetadata(
    credentials: (CredentialOfferFormat | string)[],
    credentialsSupported: CredentialSupported[]
  ) {
    const credentialsReferencingCredentialsSupported = credentials
      .filter((credential): credential is string => typeof credential === 'string')
      .map((credentialId) => this.mapInlineCredentialOfferIdToCredentialSupported(credentialId, credentialsSupported))
      .map((credentialSupported) => this.getCredentialMetadata(credentialSupported))

    const inlineCredentialOffers = credentials
      .filter((credential): credential is CredentialOfferFormat => typeof credential !== 'string')
      .map((credential) => this.getCredentialMetadata(credential))

    return [...credentialsReferencingCredentialsSupported, ...inlineCredentialOffers]
  }

  public async createCredentialOfferAndRequest(
    agentContext: AgentContext,
    offeredCredentials: OfferedCredential[],
    options: CreateCredentialOfferAndRequestOptions
  ): Promise<CredentialOfferAndRequest> {
    const { preAuthorizedCodeFlowConfig, authorizationCodeFlowConfig } = options

    const issuerMetadata = options.issuerMetadata ?? this.issuerMetadata

    // this checks if the structure of the credentials is correct
    // it throws an error if a offered credential cannot be found in the credentialsSupported
    this.getOfferedCredentialsMetadata(offeredCredentials, issuerMetadata.credentialsSupported)

    const vcIssuer = this.getVcIssuer(agentContext, issuerMetadata)

    const { uri, session } = await vcIssuer.createCredentialOfferURI({
      grants: this.getGrantsFromConfig(preAuthorizedCodeFlowConfig, authorizationCodeFlowConfig),
      credentials: offeredCredentials,
      credentialOfferUri: options.credentialOfferUri,
      scheme: options.scheme ?? 'https',
      baseUri: options.baseUri,
      // TODO: THIS IS WRONG HOW TO SPECIFY ldp_ creds?
      // credentialDefinition,
    })

    return {
      credentialOfferPayload: session.credentialOffer.credential_offer,
      credentialOfferRequest: uri,
    }
  }

  private async getCredentialOfferSessionFromUri(uri: string) {
    const uriState = await this.uriStateManager.get(uri)
    if (!uriState) throw new AriesFrameworkError(`Credential offer uri '${uri}' not found.`)

    const credentialOfferSessionId = uriState.preAuthorizedCode ?? uriState.issuerState

    if (!credentialOfferSessionId) {
      throw new AriesFrameworkError(
        `Credential offer uri '${uri}' is not associated with a preAuthorizedCode or issuerState.`
      )
    }

    const credentialOfferSession = await this.credentialOfferSessionManager.get(credentialOfferSessionId)
    if (!credentialOfferSession)
      throw new AriesFrameworkError(
        `Credential offer session for '${uri}' with id '${credentialOfferSessionId}' not found.`
      )

    return { credentialOfferSessionId, credentialOfferSession }
  }

  public async getCredentialOfferFromUri(uri: string) {
    const { credentialOfferSession, credentialOfferSessionId } = await this.getCredentialOfferSessionFromUri(uri)

    credentialOfferSession.lastUpdatedAt = +new Date()
    credentialOfferSession.status = IssueStatus.OFFER_URI_RETRIEVED
    await this.credentialOfferSessionManager.set(credentialOfferSessionId, credentialOfferSession)

    return credentialOfferSession.credentialOffer.credential_offer
  }

  private findOfferedCredentialsMatchingRequest(
    credentialOffer: CredentialOfferPayloadV1_0_11,
    credentialRequest: CredentialRequestV1_0_11,
    credentialsSupported: CredentialSupported[]
  ) {
    const offeredCredentials = this.getOfferedCredentialsMetadata(credentialOffer.credentials, credentialsSupported)

    return offeredCredentials.filter((offeredCredential) => {
      if (credentialRequest.format === 'jwt_vc_json' && offeredCredential.format === 'jwt_vc_json') {
        return equalsIgnoreOrder(offeredCredential.types, credentialRequest.types)
      } else if (credentialRequest.format === 'jwt_vc_json-ld' && offeredCredential.format === 'jwt_vc_json-ld') {
        return equalsIgnoreOrder(offeredCredential.types, credentialRequest.types)
      } else if (credentialRequest.format === 'ldp_vc' && offeredCredential.format === 'ldp_vc') {
        return equalsIgnoreOrder(
          offeredCredential.credential_definition.types,
          credentialRequest.credential_definition.types
        )
      }
    })
  }

  private getCredentialDataSupplier = (
    agentContext: AgentContext,
    credential: W3cCredential,
    credentialsSupported: CredentialSupported[],
    issuerVerificationMethod: VerificationMethod
  ): CredentialDataSupplier => {
    return async (args: CredentialDataSupplierArgs) => {
      const { credentialRequest, credentialOffer } = args

      const offeredCredentialsMatchingRequest = this.findOfferedCredentialsMatchingRequest(
        credentialOffer.credential_offer,
        credentialRequest,
        credentialsSupported
      )

      if (offeredCredentialsMatchingRequest.length === 0) {
        throw new AriesFrameworkError('No offered credential matches the requested credential.')
      }

      const issuedCredentialMatchesRequest = offeredCredentialsMatchingRequest.find(
        (offeredCredential) =>
          ((offeredCredential.format === 'jwt_vc_json-ld' || offeredCredential.format === 'jwt_vc_json') &&
            equalsIgnoreOrder(offeredCredential.types, credential.type)) ||
          (offeredCredential.format === 'ldp_vc' &&
            equalsIgnoreOrder(offeredCredential.credential_definition.types, credential.type))
      )

      if (!issuedCredentialMatchesRequest) {
        throw new AriesFrameworkError('The credential to be issued does not match the request.')
      }

      const sphereonICredential = JsonTransformer.toJSON(credential) as ICredential

      return {
        format: credentialRequest.format,
        credential: sphereonICredential,
        signCallback: this.getCredentialSigningCallback(agentContext, issuerVerificationMethod),
      }
    }
  }

  public async createIssueCredentialResponse(
    agentContext: AgentContext,
    options: CreateIssueCredentialResponseOptions
  ) {
    const { credentialRequest, credential, verificationMethod } = options

    if (!credentialRequest.proof) {
      throw new AriesFrameworkError('No proof defined in the credentialRequest.')
    }

    const issuerMetadata = options.issuerMetadata ?? this.issuerMetadata
    const vcIssuer = this.getVcIssuer(agentContext, issuerMetadata)

    const issueCredentialResponse = await vcIssuer.issueCredential({
      credentialRequest,
      tokenExpiresIn: this.openId4VcIssuerModuleConfig.tokenExpiresIn,
      cNonceExpiresIn: this.openId4VcIssuerModuleConfig.cNonceExpiresIn,
      credentialDataSupplier: this.getCredentialDataSupplier(
        agentContext,
        credential,
        issuerMetadata.credentialsSupported,
        verificationMethod
      ),
      credential: undefined,
      newCNonce: undefined,
      credentialDataSupplierInput: undefined,
      responseCNonce: undefined,
    })

    if (!issueCredentialResponse.credential) {
      throw new AriesFrameworkError('No credential defined in the issueCredentialResponse.')
    }

    if (issueCredentialResponse.acceptance_token) {
      throw new AriesFrameworkError('Acceptance token not yet supported.')
    }

    return issueCredentialResponse
  }

  public configureRouter = (agentContext: AgentContext, router: Router, endpointConfig: EndpointConfig) => {
    // parse application/x-www-form-urlencoded
    router.use(bodyParser.urlencoded({ extended: false }))

    // parse application/json
    router.use(bodyParser.json())

    if (endpointConfig.metadataEndpointConfig?.enabled) {
      configureIssuerMetadataEndpoint(router, this.logger, {
        ...endpointConfig.metadataEndpointConfig,
        issuerMetadata: this.issuerMetadata,
      })
    }

    if (endpointConfig.accessTokenEndpointConfig?.enabled) {
      configureAccessTokenEndpoint(agentContext, router, this.logger, {
        ...endpointConfig.accessTokenEndpointConfig,
        issuerMetadata: this.issuerMetadata,
        cNonceStateManager: this.cNonceStateManager,
        cNonceExpiresIn: this.openId4VcIssuerModuleConfig.cNonceExpiresIn,
        tokenExpiresIn: this.openId4VcIssuerModuleConfig.tokenExpiresIn,
        credentialOfferSessionManager: this.credentialOfferSessionManager,
      })
    }

    if (endpointConfig.credentialEndpointConfig?.enabled) {
      configureCredentialEndpoint(agentContext, router, this.logger, {
        ...endpointConfig.credentialEndpointConfig,
        issuerMetadata: this.issuerMetadata,
        createIssueCredentialResponse: (agentContext, options) => {
          const issuerService = agentContext.dependencyManager.resolve(OpenId4VcIssuerService)
          return issuerService.createIssueCredentialResponse(agentContext, options)
        },
      })
    }

    return router
  }
}
