import { AgentContext, injectable } from '@credo-ts/core'
import { OpenId4VcIssuerModuleConfig } from './OpenId4VcIssuerModuleConfig'
import { OpenId4VcIssuerService } from './OpenId4VcIssuerService'
import type {
  OpenId4VciCreateCredentialOfferOptions,
  OpenId4VciCreateIssuerOptions,
  OpenId4VciCreateStatelessCredentialOfferOptions,
  OpenId4VcUpdateIssuerOptions,
  OpenId4VcUpdateIssuerRecordOptions,
} from './OpenId4VcIssuerServiceOptions'
import { OpenId4VcIssuerRecord, OpenId4VcIssuerRepository } from './repository'

/**
 * @public
 * This class represents the API for interacting with the OpenID4VC Issuer service.
 * It provides methods for creating a credential offer and retrieving a credential offer from a URI.
 */
@injectable()
export class OpenId4VcIssuerApi {
  public constructor(
    public readonly config: OpenId4VcIssuerModuleConfig,
    private agentContext: AgentContext,
    private openId4VcIssuerService: OpenId4VcIssuerService
  ) {}

  public async getAllIssuers() {
    return this.openId4VcIssuerService.getAllIssuers(this.agentContext)
  }

  public async getIssuerByIssuerId(issuerId: string) {
    return this.openId4VcIssuerService.getIssuerByIssuerId(this.agentContext, issuerId)
  }

  /**
   * Creates an issuer and stores the corresponding issuer metadata. Multiple issuers can be created, to allow different sets of
   * credentials to be issued with each issuer.
   */
  public async createIssuer(options: OpenId4VciCreateIssuerOptions) {
    return this.openId4VcIssuerService.createIssuer(this.agentContext, options)
  }

  /**
   * Rotate the key used for signing access tokens for the issuer with the given issuerId.
   */
  public async rotateAccessTokenSigningKey(
    issuerId: string,
    options?: Pick<OpenId4VciCreateIssuerOptions, 'accessTokenSignerKeyType' | 'accessTokenSignerKmsBackend'>
  ) {
    const issuer = await this.openId4VcIssuerService.getIssuerByIssuerId(this.agentContext, issuerId)
    return this.openId4VcIssuerService.rotateAccessTokenSigningKey(this.agentContext, issuer, options)
  }

  public async updateIssuerMetadata(options: OpenId4VcUpdateIssuerRecordOptions) {
    const {
      issuerId,
      credentialConfigurationsSupported,
      display,
      issuerInfo,
      dpopSigningAlgValuesSupported,
      clientAttestationSigningAlgValuesSupported,
      clientAttestationPopSigningAlgValuesSupported,
      batchCredentialIssuance,
      credentialResponseEncryption,
      credentialRequestEncryption,
      authorizationServerConfigs,
      metadataSigner,
    } = options

    const issuer = await this.openId4VcIssuerService.getIssuerByIssuerId(this.agentContext, issuerId)

    issuer.credentialConfigurationsSupported = credentialConfigurationsSupported
    issuer.display = display
    issuer.issuerInfo = issuerInfo
    issuer.dpopSigningAlgValuesSupported = dpopSigningAlgValuesSupported
    issuer.clientAttestationSigningAlgValuesSupported = clientAttestationSigningAlgValuesSupported
    issuer.clientAttestationPopSigningAlgValuesSupported = clientAttestationPopSigningAlgValuesSupported
    issuer.batchCredentialIssuance = batchCredentialIssuance
    issuer.credentialResponseEncryption = credentialResponseEncryption
    issuer.credentialRequestEncryption = credentialRequestEncryption
    issuer.authorizationServerConfigs = authorizationServerConfigs

    return this.openId4VcIssuerService.updateIssuer(this.agentContext, issuer, { metadataSigner })
  }

  /**
   * Updates an issuer and stores the corresponding updated issuer metadata.
   */
  public async updateIssuer(issuer: OpenId4VcIssuerRecord, options?: OpenId4VcUpdateIssuerOptions) {
    return this.openId4VcIssuerService.updateIssuer(this.agentContext, issuer, options)
  }

  /**
   * Creates a stateless credential offer. This can only be used with an external authorization server, as credo only supports stateful
   * credential offers.
   */
  public async createStatelessCredentialOffer(
    options: OpenId4VciCreateStatelessCredentialOfferOptions & { issuerId: string }
  ) {
    const { issuerId, ...rest } = options
    // Only read, so it can come from the request context cache
    const issuer = await this.agentContext
      .resolve(OpenId4VcIssuerRepository)
      .getCachedByIssuerId(this.agentContext, issuerId)
    return await this.openId4VcIssuerService.createStatelessCredentialOffer(this.agentContext, { ...rest, issuer })
  }

  /**
   * Creates a credential offer. Either the preAuthorizedCodeFlowConfig or the authorizationCodeFlowConfig must be provided.
   *
   * @returns Object containing the payload of the credential offer and the credential offer request, which can be sent to the wallet.
   */
  public async createCredentialOffer(options: OpenId4VciCreateCredentialOfferOptions & { issuerId: string }) {
    const { issuerId, ...rest } = options
    // Only read, so it can come from the request context cache
    const issuer = await this.agentContext
      .resolve(OpenId4VcIssuerRepository)
      .getCachedByIssuerId(this.agentContext, issuerId)
    return await this.openId4VcIssuerService.createCredentialOffer(this.agentContext, { ...rest, issuer })
  }

  public async getIssuerMetadata(issuerId: string) {
    // Only read, so it can come from the request context cache
    const issuer = await this.agentContext
      .resolve(OpenId4VcIssuerRepository)
      .getCachedByIssuerId(this.agentContext, issuerId)
    return this.openId4VcIssuerService.getIssuerMetadata(this.agentContext, issuer)
  }

  public async getIssuanceSessionById(issuanceSessionId: string) {
    return this.openId4VcIssuerService.getIssuanceSessionById(this.agentContext, issuanceSessionId)
  }

  /**
   * Delete an issuance session record by id.
   *
   * @param options.deleteChainedDpopKey Delete the chained authorization server DPoP key that Credo
   * generated for this session. Caller-configured keys are never deleted. Defaults to `true`.
   */
  public async deleteIssuanceSessionById(issuanceSessionId: string, options?: { deleteChainedDpopKey?: boolean }) {
    return this.openId4VcIssuerService.deleteIssuanceSessionById(this.agentContext, issuanceSessionId, options)
  }
}
