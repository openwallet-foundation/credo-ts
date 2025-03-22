import type { Query, QueryOptions } from '@credo-ts/core'
import type {
  OpenId4VcUpdateVerifierRecordOptions,
  OpenId4VpCreateAuthorizationRequestOptions,
  OpenId4VpCreateAuthorizationRequestReturn,
  OpenId4VpCreateVerifierOptions,
  OpenId4VpVerifyAuthorizationResponseOptions,
} from './OpenId4VpVerifierServiceOptions'
import type { OpenId4VcVerificationSessionRecord } from './repository'

import { AgentContext, injectable } from '@credo-ts/core'

import { OpenId4VcVerifierModuleConfig } from './OpenId4VcVerifierModuleConfig'
import { OpenId4VpVerifierService } from './OpenId4VpVerifierService'

/**
 * @public
 */
@injectable()
export class OpenId4VcVerifierApi {
  public constructor(
    public readonly config: OpenId4VcVerifierModuleConfig,
    private agentContext: AgentContext,
    private openId4VpVerifierService: OpenId4VpVerifierService
  ) {}

  /**
   * Retrieve all verifier records from storage
   */
  public async getAllVerifiers() {
    return this.openId4VpVerifierService.getAllVerifiers(this.agentContext)
  }

  /**
   * Retrieve a verifier record from storage by its verified id
   */
  public async getVerifierByVerifierId(verifierId: string) {
    return this.openId4VpVerifierService.getVerifierByVerifierId(this.agentContext, verifierId)
  }

  /**
   * Create a new verifier and store the new verifier record.
   */
  public async createVerifier(options?: OpenId4VpCreateVerifierOptions) {
    return this.openId4VpVerifierService.createVerifier(this.agentContext, options)
  }

  public async updateVerifierMetadata(options: OpenId4VcUpdateVerifierRecordOptions) {
    const { verifierId, clientMetadata } = options

    const verifier = await this.openId4VpVerifierService.getVerifierByVerifierId(this.agentContext, verifierId)

    verifier.clientMetadata = clientMetadata

    return this.openId4VpVerifierService.updateVerifier(this.agentContext, verifier)
  }

  public async findVerificationSessionsByQuery(
    query: Query<OpenId4VcVerificationSessionRecord>,
    queryOptions?: QueryOptions
  ) {
    return this.openId4VpVerifierService.findVerificationSessionsByQuery(this.agentContext, query, queryOptions)
  }

  public async getVerificationSessionById(verificationSessionId: string) {
    return this.openId4VpVerifierService.getVerificationSessionById(this.agentContext, verificationSessionId)
  }

  /**
   * Create an OpenID4VP authorization request, acting as a Relying Party (RP).
   *
   * See {@link OpenId4VpCreateAuthorizationRequestOptions} for detailed documentation on the options.
   */
  public async createAuthorizationRequest({
    verifierId,
    ...otherOptions
  }: OpenId4VpCreateAuthorizationRequestOptions & {
    verifierId: string
  }): Promise<OpenId4VpCreateAuthorizationRequestReturn> {
    const verifier = await this.getVerifierByVerifierId(verifierId)
    return await this.openId4VpVerifierService.createAuthorizationRequest(this.agentContext, {
      ...otherOptions,
      verifier,
    })
  }

  /**
   * Verifies an authorization response, acting as a Relying Party (RP).
   *
   * It validates the ID Token, VP Token and the signature(s) of the received Verifiable Presentation(s)
   * as well as that the structure of the Verifiable Presentation matches the provided presentation definition.
   */
  public async verifyAuthorizationResponse({
    verificationSessionId,
    ...otherOptions
  }: OpenId4VpVerifyAuthorizationResponseOptions & {
    verificationSessionId: string
  }) {
    const verificationSession = await this.getVerificationSessionById(verificationSessionId)
    return await this.openId4VpVerifierService.verifyAuthorizationResponse(this.agentContext, {
      ...otherOptions,
      verificationSession,
    })
  }

  public async getVerifiedAuthorizationResponse(verificationSessionId: string) {
    const verificationSession = await this.getVerificationSessionById(verificationSessionId)
    return this.openId4VpVerifierService.getVerifiedAuthorizationResponse(this.agentContext, verificationSession)
  }
}
