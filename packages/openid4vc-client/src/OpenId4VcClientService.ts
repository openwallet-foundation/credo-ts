import type { AgentContext } from '@aries-framework/core'
import type { AccessTokenResponse, EndpointMetadata, Jwt } from '@sphereon/openid4vci-client'

import {
  AriesFrameworkError,
  DidsApi,
  getKeyFromVerificationMethod,
  Hasher,
  inject,
  injectable,
  InjectionSymbols,
  isJwtAlgorithm,
  JsonEncoder,
  JsonTransformer,
  JwsService,
  jwtKeyAlgMapping,
  Logger,
  TypedArrayEncoder,
  W3cCredentialService,
  W3cVerifiableCredential,
} from '@aries-framework/core'
import {
  Alg,
  AuthzFlowType,
  CodeChallengeMethod,
  CredentialRequestClientBuilder,
  OpenID4VCIClient,
  ProofOfPossessionBuilder,
} from '@sphereon/openid4vci-client'
import { randomStringForEntropy } from '@stablelib/random'

export interface PreAuthCodeFlowOptions {
  issuerUri: string
  kid: string
  verifyRevocationState: boolean
  scope?: string[]
}

export interface AuthCodeFlowOptions extends PreAuthCodeFlowOptions {
  clientId: string
  authorizationCode: string
  codeVerifier: string
  redirectUri: string
}

export enum AuthFlowType {
  AuthorizationCodeFlow,
  PreAuthorizedCodeFlow,
}

export type RequestCredentialOptions = { flowType: AuthFlowType } & PreAuthCodeFlowOptions &
  Partial<AuthCodeFlowOptions>

// The code_challenge_method is omitted here
// because we assume it will always be SHA256
// as clear text code_challenges are unsafe
export interface GenerateAuthorizationUrlOptions {
  initiationUri: string
  clientId: string
  redirectUri: string
  scope?: string[]
}

@injectable()
export class OpenId4VcClientService {
  private logger: Logger
  private w3cCredentialService: W3cCredentialService
  private jwsService: JwsService

  public constructor(
    @inject(InjectionSymbols.Logger) logger: Logger,
    w3cCredentialService: W3cCredentialService,
    jwsService: JwsService
  ) {
    this.w3cCredentialService = w3cCredentialService
    this.jwsService = jwsService
    this.logger = logger
  }

  private signCallback(agentContext: AgentContext) {
    return async (jwt: Jwt, kid: string) => {
      if (!jwt.header) {
        throw new AriesFrameworkError('No header present on JWT')
      }

      if (!jwt.payload) {
        throw new AriesFrameworkError('No payload present on JWT')
      }
      if (!kid.startsWith('did:')) {
        throw new AriesFrameworkError(`kid '${kid}' is not a valid did. Only dids are supported as kid.`)
      }

      if (!kid.includes('#')) {
        throw new AriesFrameworkError(
          `kid '${kid}' does not include a reference to the verificationMethod. The kid must specify a specific verificationMethod within the did document .`
        )
      }

      const did = kid.split('#')[0]

      const didsApi = agentContext.dependencyManager.resolve(DidsApi)
      const [didRecord] = await didsApi.getCreatedDids({ did })

      if (!didRecord) {
        throw new AriesFrameworkError(`No did record found for did ${did}. Is the did created by this agent?`)
      }

      const didResult = await didsApi.resolve(did)

      if (!didResult.didDocument) {
        throw new AriesFrameworkError(
          `No did document found for did ${did}. ${didResult.didResolutionMetadata.error} - ${didResult.didResolutionMetadata.message}`
        )
      }

      // TODO: which purposes are allowed?
      const verificationMethod = didResult.didDocument.dereferenceKey(kid, ['authentication'])
      const key = getKeyFromVerificationMethod(verificationMethod)

      const payload = JsonEncoder.toBuffer(jwt.payload)

      if (!isJwtAlgorithm(jwt.header.alg)) {
        throw new AriesFrameworkError(`Unknown JWT algorithm: ${jwt.header.alg}`)
      }

      if (jwtKeyAlgMapping[jwt.header.alg].includes(key.keyType)) {
        throw new AriesFrameworkError(
          `The retreived key's type does't match the JWT algorithm. Key type: ${key.keyType}, JWT algorithm: ${jwt.header.alg}`
        )
      }

      const jws = await this.jwsService.createJwsCompact(agentContext, {
        key,
        payload,
        protectedHeaderOptions: {
          alg: jwt.header.alg,
          kid: jwt.header.kid,
        },
      })

      return jws
    }
  }

  private getSignCallback(agentContext: AgentContext) {
    return {
      signCallback: this.signCallback(agentContext),
    }
  }

  private assertCredentialHasFormat(format: string, scope: string, metadata: EndpointMetadata) {
    if (!metadata.openid4vci_metadata) {
      throw new AriesFrameworkError(
        `Server metadata doesn't include OpenID4VCI metadata. Unable to verify if the issuer supports the requested credential format: ${format}`
      )
    }

    const supportedFomats = Object.keys(metadata.openid4vci_metadata?.credentials_supported[scope].formats)

    if (!supportedFomats.includes(format)) {
      throw new AriesFrameworkError(
        `Issuer doesn't support the requested credential format '${format}'' for requested credential type '${scope}'. Supported formats are: ${supportedFomats}`
      )
    }
  }

  private generateCodeVerifier(): string {
    return randomStringForEntropy(256)
  }

  public async generateAuthorizationUrl(options: GenerateAuthorizationUrlOptions) {
    this.logger.debug('Generating authorization url')

    if (!options.scope || options.scope.length === 0) {
      throw new AriesFrameworkError(
        'Only scoped based authorization requests are supported at this time. Please provide at least one scope'
      )
    }

    const client = await OpenID4VCIClient.initiateFromURI({
      issuanceInitiationURI: options.initiationUri,
      flowType: AuthzFlowType.AUTHORIZATION_CODE_FLOW,
    })
    const codeVerifier = this.generateCodeVerifier()
    const codeVerifierSha256 = Hasher.hash(TypedArrayEncoder.fromString(codeVerifier), 'sha2-256')
    const base64Url = TypedArrayEncoder.toBase64URL(codeVerifierSha256)

    this.logger.debug('Converted code_verifier to code_challenge', {
      codeVerifier: codeVerifier,
      sha256: codeVerifierSha256.toString(),
      base64Url: base64Url,
    })

    const authorizationUrl = client.createAuthorizationRequestUrl({
      clientId: options.clientId,
      codeChallengeMethod: CodeChallengeMethod.SHA256,
      codeChallenge: base64Url,
      redirectUri: options.redirectUri,
      scope: options.scope?.join(' '),
    })

    return {
      authorizationUrl,
      codeVerifier,
    }
  }

  public async requestCredential(agentContext: AgentContext, options: RequestCredentialOptions) {
    const credentialFormat = 'ldp_vc'

    let flowType: AuthzFlowType
    if (options.flowType === AuthFlowType.AuthorizationCodeFlow) {
      flowType = AuthzFlowType.AUTHORIZATION_CODE_FLOW
    } else if (options.flowType === AuthFlowType.PreAuthorizedCodeFlow) {
      flowType = AuthzFlowType.PRE_AUTHORIZED_CODE_FLOW
    } else {
      throw new AriesFrameworkError(
        `Unsupported flowType ${options.flowType}. Valid values are ${Object.values(AuthFlowType)}`
      )
    }

    const client = await OpenID4VCIClient.initiateFromURI({
      issuanceInitiationURI: options.issuerUri,
      flowType,
      kid: options.kid,
      alg: Alg.EdDSA,
    })

    let accessToken: AccessTokenResponse

    if (options.flowType === AuthFlowType.AuthorizationCodeFlow) {
      if (!options.authorizationCode)
        throw new AriesFrameworkError(
          `The 'authorizationCode' parameter is required when 'flowType' is ${options.flowType}`
        )
      if (!options.codeVerifier)
        throw new AriesFrameworkError(`The 'codeVerifier' parameter is required when 'flowType' is ${options.flowType}`)
      if (!options.redirectUri)
        throw new AriesFrameworkError(`The 'redirectUri' parameter is required when 'flowType' is ${options.flowType}`)

      accessToken = await client.acquireAccessToken({
        clientId: options.clientId,
        code: options.authorizationCode,
        codeVerifier: options.codeVerifier,
        redirectUri: options.redirectUri,
      })
    } else {
      accessToken = await client.acquireAccessToken({})
    }

    const serverMetadata = await client.retrieveServerMetadata()

    this.logger.info('Fetched server metadata', {
      issuer: serverMetadata.issuer,
      credentialEndpoint: serverMetadata.credential_endpoint,
      tokenEndpoint: serverMetadata.token_endpoint,
    })

    this.logger.debug('Full server metadata', serverMetadata)

    let scope: string

    if (accessToken.scope) {
      scope = accessToken.scope
    } else {
      if (!options.scope || options.scope.length === 0) {
        throw new AriesFrameworkError(
          'The access_token response does not include a scope and no scope was provided in the request. Unable to determine the credential type.'
        )
      }
      scope = options.scope.join(' ')
    }

    for (const credentialType of scope.split(' ')) {
      this.assertCredentialHasFormat(credentialFormat, credentialType, serverMetadata)
    }

    // proof of possession
    const callbacks = this.getSignCallback(agentContext)

    const proofInput = await ProofOfPossessionBuilder.fromAccessTokenResponse({
      accessTokenResponse: accessToken,
      callbacks: callbacks,
    })
      .withEndpointMetadata(serverMetadata)
      .withAlg(Alg.EdDSA)
      .withKid(options.kid)
      .build()

    this.logger.debug('Generated JWS', proofInput)

    const credentialRequestClient = CredentialRequestClientBuilder.fromIssuanceInitiationURI({
      uri: options.issuerUri,
      metadata: serverMetadata,
    })
      .withTokenFromResponse(accessToken)
      .build()

    const credentialResponse = await credentialRequestClient.acquireCredentialsUsingProof({
      proofInput,
      credentialType: scope,
      format: credentialFormat,
    })

    this.logger.debug('Credential request response', credentialResponse)

    if (!credentialResponse.successBody) {
      throw new AriesFrameworkError('Did not receive a successful credential response')
    }

    const credential = JsonTransformer.fromJSON(credentialResponse.successBody.credential, W3cVerifiableCredential)

    // verify the signature
    const result = await this.w3cCredentialService.verifyCredential(agentContext, {
      credential,
      verifyRevocationState: options.verifyRevocationState,
    })

    if (result && !result.verified) {
      throw new AriesFrameworkError(`Failed to validate credential, error = ${result.error}`)
    }

    const storedCredential = await this.w3cCredentialService.storeCredential(agentContext, {
      credential,
    })

    this.logger.info(`Stored credential with id: ${storedCredential.id}`)
    this.logger.debug('Full credential', storedCredential)

    return storedCredential
  }
}
