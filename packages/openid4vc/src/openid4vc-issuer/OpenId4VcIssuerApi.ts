import { AgentContext, injectable } from '@credo-ts/core'
import { OpenId4VcIssuerModuleConfig } from './OpenId4VcIssuerModuleConfig'
import { OpenId4VcIssuerService } from './OpenId4VcIssuerService'
import type {
  OpenId4VciCreateCredentialOfferOptions,
  OpenId4VciCreateCredentialResponseOptions,
  OpenId4VciCreateDeferredCredentialResponseOptions,
  OpenId4VciCreateIssuerOptions,
  OpenId4VciCreateStatelessCredentialOfferOptions,
  OpenId4VcUpdateIssuerOptions,
  OpenId4VcUpdateIssuerRecordOptions,
} from './OpenId4VcIssuerServiceOptions'
import { OpenId4VcIssuerRecord } from './repository'

/**
 * @public
 * This class represents the API for interacting with the OpenID4VC Issuer service.
 * It provides methods for creating a credential offer, creating a response to a credential issuance request,
 * and retrieving a credential offer from a URI.
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
   *
   * Throws if an issuer with the issuer id already exists, or with multi-tenancy if another tenant has an issuer or
   * verifier with that id.
   */
  public async createIssuer(options: OpenId4VciCreateIssuerOptions) {
    return this.openId4VcIssuerService.createIssuer(this.agentContext, options)
  }

  /**
   * Deletes the issuer, so requests for its issuer id are no longer handled.
   *
   * Throws if the issuer still has issuance sessions. Delete them first with {@link deleteIssuanceSessionById}.
   *
   * @param options.deleteAssociatedKeys Also delete the KMS keys the issuer record references: the access token signing
   * key and the credential request encryption keys in `jwks` and `previousJwks`. Set it to `false` if other issuers or
   * code still use the request encryption keys. Defaults to `true`.
   */
  public async deleteIssuer(issuerId: string, options?: { deleteAssociatedKeys?: boolean }) {
    return this.openId4VcIssuerService.deleteIssuer(this.agentContext, issuerId, options)
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
    const issuer = await this.openId4VcIssuerService.getIssuerByIssuerId(this.agentContext, issuerId)
    return await this.openId4VcIssuerService.createStatelessCredentialOffer(this.agentContext, { ...rest, issuer })
  }

  /**
   * Creates a credential offer. Either the preAuthorizedCodeFlowConfig or the authorizationCodeFlowConfig must be provided.
   *
   * @returns Object containing the payload of the credential offer and the credential offer request, which can be sent to the wallet.
   */
  public async createCredentialOffer(options: OpenId4VciCreateCredentialOfferOptions & { issuerId: string }) {
    const { issuerId, ...rest } = options
    const issuer = await this.openId4VcIssuerService.getIssuerByIssuerId(this.agentContext, issuerId)
    return await this.openId4VcIssuerService.createCredentialOffer(this.agentContext, { ...rest, issuer })
  }

  /**
   * This function creates a response which can be sent to the holder after receiving a credential issuance request.
   */
  public async createCredentialResponse(
    options: OpenId4VciCreateCredentialResponseOptions & { issuanceSessionId: string }
  ) {
    const { issuanceSessionId, ...rest } = options
    const issuanceSession = await this.openId4VcIssuerService.getIssuanceSessionById(
      this.agentContext,
      issuanceSessionId
    )

    return await this.openId4VcIssuerService.createCredentialResponse(this.agentContext, { ...rest, issuanceSession })
  }

  /**
   * This function creates a response which can be sent to the holder after receiving a deferred credential issuance request.
   */
  public async createDeferredCredentialResponse(
    options: OpenId4VciCreateDeferredCredentialResponseOptions & { issuanceSessionId: string }
  ) {
    const { issuanceSessionId, ...rest } = options
    const issuanceSession = await this.openId4VcIssuerService.getIssuanceSessionById(
      this.agentContext,
      issuanceSessionId
    )

    return await this.openId4VcIssuerService.createDeferredCredentialResponse(this.agentContext, {
      ...rest,
      issuanceSession,
    })
  }

  public async getIssuerMetadata(issuerId: string) {
    const issuer = await this.openId4VcIssuerService.getIssuerByIssuerId(this.agentContext, issuerId)
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
