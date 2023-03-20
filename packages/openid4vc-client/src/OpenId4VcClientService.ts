import type { AgentContext, W3cCredentialRecord } from '@aries-framework/core'
import type { EndpointMetadata, Jwt } from '@sphereon/openid4vci-client'

import {
  getKeyFromVerificationMethod,
  AriesFrameworkError,
  Buffer,
  DidsApi,
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
import { hash as sha256 } from '@stablelib/sha256'

export interface PreAuthorizedOptions {
  issuerUri: string
  kid: string
  checkRevocationState: boolean
}

export interface RequestCredentialOptions {
  clientId: string
  code: string
  codeVerifier: string
  issuerUri: string
  kid: string
  redirectUri: string
  checkRevocationState: boolean
}

// The code_challenge_method is omitted here
// because we assume it will always be SHA256
// as clear text code_challenges are unsafe
export interface GenerateAuthorizationUrlOptions {
  initiationUri: string
  clientId: string
  codeVerifier: string
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

  public generateCodeVerifier(): string {
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

    const hashed = sha256(TypedArrayEncoder.fromString(options.codeVerifier))
    const base64Url = TypedArrayEncoder.toBase64URL(Buffer.from(hashed))

    this.logger.debug('Converted code_verifier to code_challenge', {
      codeVerifier: options.codeVerifier.toString(),
      sha256: hashed.toString(),
      base64Url: base64Url,
    })

    return client.createAuthorizationRequestUrl({
      clientId: options.clientId,
      codeChallengeMethod: CodeChallengeMethod.SHA256,
      codeChallenge: base64Url,
      redirectUri: options.redirectUri,
      scope: options.scope?.join(' '),
    })
  }

  public async requestCredentialPreAuthorized(
    agentContext: AgentContext,
    options: PreAuthorizedOptions
  ): Promise<W3cCredentialRecord> {
    this.logger.debug('Running pre-authorized flow with options', options)

    // this value is hardcoded as it's the only supported format at this point
    const credentialFormat = 'ldp_vc'

    const client = await OpenID4VCIClient.initiateFromURI({
      issuanceInitiationURI: options.issuerUri,
      flowType: AuthzFlowType.PRE_AUTHORIZED_CODE_FLOW,
      kid: options.kid,
      alg: Alg.EdDSA,
    })

    const accessToken = await client.acquireAccessToken({})

    this.logger.info('Fetched server accessToken', accessToken)

    // We currently need the ts-ignore because the type
    // inside of OpenID4VCIClient needs to be updated.
    // @ts-ignore
    if (!accessToken.scope) {
      throw new AriesFrameworkError(
        "Access token response doesn't contain a scope. Only scoped issuer URIs are supported at this time."
      )
    }

    const serverMetadata = await client.retrieveServerMetadata()

    // @ts-ignore
    this.assertCredentialHasFormat(credentialFormat, accessToken.scope, serverMetadata)

    this.logger.info('Fetched server metadata', {
      issuer: serverMetadata.issuer,
      credentialEndpoint: serverMetadata.credential_endpoint,
      tokenEndpoint: serverMetadata.token_endpoint,
    })

    this.logger.debug('Full server metadata', serverMetadata)

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
      // @ts-ignore
      credentialType: accessToken.scope,
      format: 'ldp_vc', // Allows us to override the format
    })

    this.logger.debug('Credential request response', credentialResponse)

    if (!credentialResponse.successBody) {
      throw new AriesFrameworkError('Did not receive a successful credential response')
    }

    const credential = JsonTransformer.fromJSON(credentialResponse.successBody.credential, W3cVerifiableCredential)

    // verify the signature
    const result = await this.w3cCredentialService.verifyCredential(
      agentContext,
      { credential },
      options.checkRevocationState
    )

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

  public async requestCredential(agentContext: AgentContext, options: RequestCredentialOptions) {
    const credentialFormat = 'ldp_vc'
    const client = await OpenID4VCIClient.initiateFromURI({
      issuanceInitiationURI: options.issuerUri,
      kid: options.kid,
      flowType: AuthzFlowType.AUTHORIZATION_CODE_FLOW,
      alg: Alg.EdDSA,
    })

    const accessToken = await client.acquireAccessToken({
      clientId: options.clientId,
      code: options.code,
      codeVerifier: options.codeVerifier,
      redirectUri: options.redirectUri,
    })

    const serverMetadata = await client.retrieveServerMetadata()
    // @ts-ignore
    this.assertCredentialHasFormat(credentialFormat, accessToken.scope, serverMetadata)

    this.logger.info('Fetched server metadata', {
      issuer: serverMetadata.issuer,
      credentialEndpoint: serverMetadata.credential_endpoint,
      tokenEndpoint: serverMetadata.token_endpoint,
    })

    this.logger.debug('Full server metadata', serverMetadata)

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
      credentialType: accessToken.scope,
      format: 'ldp_vc', // Allows us to override the format
    })

    this.logger.debug('Credential request response', credentialResponse)

    if (!credentialResponse.successBody) {
      throw new AriesFrameworkError('Did not receive a successful credential response')
    }

    const credential = JsonTransformer.fromJSON(credentialResponse.successBody.credential, W3cVerifiableCredential)

    // verify the signature
    const result = await this.w3cCredentialService.verifyCredential(
      agentContext,
      { credential },
      options.checkRevocationState
    )

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
