import type {
  IssueCredentialOptions,
  CreateCredentialOfferOptions,
  CredentialOfferAndRequest,
  OfferedCredential,
} from './OpenId4VcIssuerServiceOptions'
import type { CredentialOfferPayload } from '@sphereon/oid4vci-common'

import { injectable, AgentContext } from '@aries-framework/core'

import { OpenId4VcIssuerService } from './OpenId4VcIssuerService'

/**
 * @public
 * This class represents the API for interacting with the OpenID4VC Issuer service.
 * It provides methods for creating a credential offer, creating a response to a credential issuance request,
 * and retrieving a credential offer from a URI.
 */
@injectable()
export class OpenId4VcIssuerApi {
  private agentContext: AgentContext
  private openId4VcIssuerService: OpenId4VcIssuerService

  public constructor(agentContext: AgentContext, openId4VcIssuerService: OpenId4VcIssuerService) {
    this.agentContext = agentContext
    this.openId4VcIssuerService = openId4VcIssuerService
  }

  /**
   * Creates a credential offer, and credential offer request.
   * Either the preAuthorizedCodeFlowConfig or the authorizationCodeFlowConfig must be provided.
   *
   * @param {OfferedCredential[]} offeredCredentials - The credentials to be offered.
   * @param {IssuerMetadata} options.issuerMetadata - Metadata about the issuer.
   * @param {string} options.credentialOfferUri - The URI to retrieve the credential offer if the offer is passed by reference.
   * @param {string} options.scheme - The credential offer request scheme. Default is https.
   * @param {string} options.baseUri - The base URI of the credential offer request.
   * @param {PreAuthorizedCodeFlowConfig} options.preAuthorizedCodeFlowConfig - The configuration for the pre-authorized code flow. This or the authorizationCodeFlowConfig must be provided.
   * @param {AuthorizationCodeFlowConfig} options.authorizationCodeFlowConfig - The configuration for the authorization code flow. This or the preAuthorizedCodeFlowConfig must be provided.
   *
   * @returns {CredentialOfferAndRequest} Object containing the payload of the credential offer and the credential offer request, which is to be sent to the wallet.
   */
  public async createCredentialOffer(
    offeredCredentials: OfferedCredential[],
    options: CreateCredentialOfferOptions
  ): Promise<CredentialOfferAndRequest> {
    return await this.openId4VcIssuerService.createCredentialOffer(this.agentContext, offeredCredentials, options)
  }

  /**
   * This function retrieves a credential offer from a given URI.
   * Retrieving a credential offer from a URI is possible after a credential offer was created with
   * @see createCredentialOffer and the credentialOfferUri option.
   *
   * @throws if no credential offer can found for the given URI.
   * @param {string} uri - The URI for which to retrieve the credential offer.
   * @returns {CredentialOfferPayload} - The credential offer payload associated with the given URI.
   */
  public async getCredentialOfferFromUri(uri: string): Promise<CredentialOfferPayload> {
    return await this.openId4VcIssuerService.getCredentialOfferFromUri(uri)
  }

  /**
   * This function creates a response which can be send to the holder after receiving a credential issuance request.
   *
   * @param {string} options.credentialRequest - The credential request, for which to create a response.
   * @param {string} options.credential - The credential to be issued.
   * @param {IssuerMetadata} options.issuerMetadata - Metadata about the issuer.
   */
  public async createIssueCredentialResponse(options: IssueCredentialOptions) {
    return await this.openId4VcIssuerService.createIssueCredentialResponse(this.agentContext, options)
  }
}
