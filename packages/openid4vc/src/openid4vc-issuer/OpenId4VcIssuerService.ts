import type {
  OpenId4VciCredentialConfigurationSupportedWithFormats,
  OpenId4VciMetadata,
  VerifiedOpenId4VcCredentialHolderBinding,
} from '../shared'
import type {
  OpenId4VciAuthorizationCodeFlowConfig,
  OpenId4VciCreateCredentialOfferOptions,
  OpenId4VciCreateCredentialResponseOptions,
  OpenId4VciCreateIssuerOptions,
  OpenId4VciCreateStatelessCredentialOfferOptions,
  OpenId4VciCredentialRequestAuthorization,
  OpenId4VciCredentialRequestToCredentialMapperOptions,
  OpenId4VciPreAuthorizedCodeFlowConfig,
  OpenId4VciSignW3cCredentials,
} from './OpenId4VcIssuerServiceOptions'

import {
  AgentContext,
  ClaimFormat,
  CredoError,
  EventEmitter,
  JwsService,
  Jwt,
  JwtPayload,
  Key,
  KeyType,
  MdocApi,
  Query,
  QueryOptions,
  SdJwtVcApi,
  TypedArrayEncoder,
  W3cCredentialService,
  getJwkFromJson,
  getJwkFromKey,
  injectable,
  joinUriParts,
  utils,
} from '@credo-ts/core'
import {
  AuthorizationServerMetadata,
  JwtSignerJwk,
  JwtSignerWithJwk,
  Oauth2AuthorizationServer,
  Oauth2Client,
  Oauth2ErrorCodes,
  Oauth2ResourceServer,
  Oauth2ServerErrorResponseError,
  PkceCodeChallengeMethod,
  preAuthorizedCodeGrantIdentifier,
} from '@openid4vc/oauth2'
import {
  CredentialConfigurationSupportedWithFormats,
  CredentialConfigurationsSupportedWithFormats,
  CredentialIssuerMetadata,
  CredentialRequestFormatSpecific,
  Openid4vciDraftVersion,
  Openid4vciIssuer,
  ParseCredentialRequestReturn,
  extractScopesForCredentialConfigurationIds,
  getCredentialConfigurationsMatchingRequestFormat,
} from '@openid4vc/openid4vci'

import { OpenId4VcVerifierApi } from '../openid4vc-verifier'
import { OpenId4VciCredentialFormatProfile } from '../shared'
import { dynamicOid4vciClientAuthentication, getOid4vcCallbacks } from '../shared/callbacks'
import { getCredentialConfigurationsSupportedForScopes, getOfferedCredentials } from '../shared/issuerMetadataUtils'
import { storeActorIdForContextCorrelationId } from '../shared/router'
import {
  addSecondsToDate,
  dateToSeconds,
  getKeyFromDid,
  getProofTypeFromKey,
  getSupportedJwaSignatureAlgorithms,
} from '../shared/utils'

import { OpenId4VcIssuanceSessionState } from './OpenId4VcIssuanceSessionState'
import { OpenId4VcIssuanceSessionStateChangedEvent, OpenId4VcIssuerEvents } from './OpenId4VcIssuerEvents'
import { OpenId4VcIssuerModuleConfig } from './OpenId4VcIssuerModuleConfig'
import {
  OpenId4VcIssuanceSessionRecord,
  OpenId4VcIssuanceSessionRepository,
  OpenId4VcIssuerRecord,
  OpenId4VcIssuerRepository,
} from './repository'
import { generateTxCode } from './util/txCode'

/**
 * @internal
 */
@injectable()
export class OpenId4VcIssuerService {
  private w3cCredentialService: W3cCredentialService
  private openId4VcIssuerConfig: OpenId4VcIssuerModuleConfig
  private openId4VcIssuerRepository: OpenId4VcIssuerRepository
  private openId4VcIssuanceSessionRepository: OpenId4VcIssuanceSessionRepository

  public constructor(
    w3cCredentialService: W3cCredentialService,
    openId4VcIssuerConfig: OpenId4VcIssuerModuleConfig,
    openId4VcIssuerRepository: OpenId4VcIssuerRepository,
    openId4VcIssuanceSessionRepository: OpenId4VcIssuanceSessionRepository
  ) {
    this.w3cCredentialService = w3cCredentialService
    this.openId4VcIssuerConfig = openId4VcIssuerConfig
    this.openId4VcIssuerRepository = openId4VcIssuerRepository
    this.openId4VcIssuanceSessionRepository = openId4VcIssuanceSessionRepository
  }

  public async createStatelessCredentialOffer(
    agentContext: AgentContext,
    options: OpenId4VciCreateStatelessCredentialOfferOptions & { issuer: OpenId4VcIssuerRecord }
  ) {
    const { authorizationCodeFlowConfig, issuer, credentialConfigurationIds } = options
    const vcIssuer = this.getIssuer(agentContext)
    const issuerMetadata = await this.getIssuerMetadata(agentContext, issuer)

    const uniqueOfferedCredentials = Array.from(new Set(options.credentialConfigurationIds))
    if (uniqueOfferedCredentials.length !== credentialConfigurationIds.length) {
      throw new CredoError('All offered credentials must have unique ids.')
    }

    // Check if all the offered credential configuration ids have a scope value. If not, it won't be possible to actually request
    // issuance of the credential later on
    extractScopesForCredentialConfigurationIds({
      credentialConfigurationIds: options.credentialConfigurationIds,
      issuerMetadata,
      throwOnConfigurationWithoutScope: true,
    })

    if (authorizationCodeFlowConfig.authorizationServerUrl === issuerMetadata.credentialIssuer.credential_issuer) {
      throw new CredoError(
        'Stateless offers can only be created for external authorization servers. Make sure to configure an external authorization server on the issuer record, and provide the authoriation server url.'
      )
    }

    const { credentialOffer, credentialOfferObject } = await vcIssuer.createCredentialOffer({
      credentialConfigurationIds: options.credentialConfigurationIds,
      grants: {
        authorization_code: {
          authorization_server: authorizationCodeFlowConfig.authorizationServerUrl,
        },
      },
      credentialOfferScheme: options.baseUri,
      issuerMetadata,
    })

    return {
      credentialOffer,
      credentialOfferObject,
    }
  }

  public async createCredentialOffer(
    agentContext: AgentContext,
    options: OpenId4VciCreateCredentialOfferOptions & { issuer: OpenId4VcIssuerRecord }
  ) {
    const {
      preAuthorizedCodeFlowConfig,
      authorizationCodeFlowConfig,
      issuer,
      credentialConfigurationIds,
      version = 'v1.draft11-15',
      authorization,
    } = options
    if (!preAuthorizedCodeFlowConfig && !authorizationCodeFlowConfig) {
      throw new CredoError('Authorization Config or Pre-Authorized Config must be provided.')
    }

    const vcIssuer = this.getIssuer(agentContext)
    const issuerMetadata = await this.getIssuerMetadata(agentContext, issuer)

    const uniqueOfferedCredentials = Array.from(new Set(options.credentialConfigurationIds))
    if (uniqueOfferedCredentials.length !== credentialConfigurationIds.length) {
      throw new CredoError('All offered credentials must have unique ids.')
    }

    if (uniqueOfferedCredentials.length === 0) {
      throw new CredoError('You need to offer at least one credential.')
    }

    // We always use shortened URIs currently
    const credentialOfferId = utils.uuid()
    const hostedCredentialOfferUri = joinUriParts(issuerMetadata.credentialIssuer.credential_issuer, [
      this.openId4VcIssuerConfig.credentialOfferEndpointPath,
      credentialOfferId,
    ])

    // Check if all the offered credential configuration ids have a scope value. If not, it won't be possible to actually request
    // issuance of the credential later on. For pre-auth it's not needed to add a scope.
    if (options.authorizationCodeFlowConfig) {
      extractScopesForCredentialConfigurationIds({
        credentialConfigurationIds: options.credentialConfigurationIds,
        issuerMetadata,
        throwOnConfigurationWithoutScope: true,
      })
    }

    const grants = await this.getGrantsFromConfig(agentContext, {
      issuerMetadata,
      preAuthorizedCodeFlowConfig,
      authorizationCodeFlowConfig,
    })

    const { credentialOffer, credentialOfferObject } = await vcIssuer.createCredentialOffer({
      credentialConfigurationIds: options.credentialConfigurationIds,
      grants,
      credentialOfferUri: hostedCredentialOfferUri,
      credentialOfferScheme: options.baseUri,
      issuerMetadata: {
        originalDraftVersion:
          version === 'v1.draft11-15' ? Openid4vciDraftVersion.Draft11 : Openid4vciDraftVersion.Draft15,
        ...issuerMetadata,
      },
    })

    const issuanceSessionRepository = this.openId4VcIssuanceSessionRepository
    const issuanceSession = new OpenId4VcIssuanceSessionRecord({
      credentialOfferPayload: credentialOfferObject,
      credentialOfferUri: hostedCredentialOfferUri,
      credentialOfferId,
      issuerId: issuer.issuerId,
      state: OpenId4VcIssuanceSessionState.OfferCreated,
      authorization: credentialOfferObject.grants?.authorization_code?.issuer_state
        ? {
            issuerState: credentialOfferObject.grants?.authorization_code?.issuer_state,
          }
        : undefined,
      presentation: authorizationCodeFlowConfig?.requirePresentationDuringIssuance
        ? {
            required: true,
          }
        : undefined,
      dpop: authorization?.requireDpop
        ? {
            required: true,
          }
        : undefined,
      walletAttestation: authorization?.requireWalletAttestation
        ? {
            required: true,
          }
        : undefined,
      // TODO: how to mix pre-auth and auth? Need to do state checks
      preAuthorizedCode: credentialOfferObject.grants?.[preAuthorizedCodeGrantIdentifier]?.['pre-authorized_code'],
      userPin: preAuthorizedCodeFlowConfig?.txCode
        ? generateTxCode(agentContext, preAuthorizedCodeFlowConfig.txCode)
        : undefined,
      issuanceMetadata: options.issuanceMetadata,
    })
    await issuanceSessionRepository.save(agentContext, issuanceSession)
    this.emitStateChangedEvent(agentContext, issuanceSession, null)

    return {
      issuanceSession,
      credentialOffer,
    }
  }

  public async createCredentialResponse(
    agentContext: AgentContext,
    options: OpenId4VciCreateCredentialResponseOptions & { issuanceSession: OpenId4VcIssuanceSessionRecord }
  ) {
    options.issuanceSession.assertState([
      // OfferUriRetrieved is valid when doing auth flow (we should add a check)
      OpenId4VcIssuanceSessionState.OfferUriRetrieved,
      OpenId4VcIssuanceSessionState.AccessTokenCreated,
      OpenId4VcIssuanceSessionState.CredentialRequestReceived,
      // It is possible to issue multiple credentials in one session
      OpenId4VcIssuanceSessionState.CredentialsPartiallyIssued,
    ])
    const { issuanceSession } = options
    const issuer = await this.getIssuerByIssuerId(agentContext, options.issuanceSession.issuerId)
    const vcIssuer = this.getIssuer(agentContext, { issuanceSessionId: issuanceSession.id })
    const issuerMetadata = await this.getIssuerMetadata(agentContext, issuer)

    const parsedCredentialRequest = vcIssuer.parseCredentialRequest({
      issuerMetadata,
      credentialRequest: options.credentialRequest,
    })
    const {
      credentialRequest,
      credentialIdentifier,

      format,
    } = parsedCredentialRequest

    if (credentialIdentifier) {
      throw new Oauth2ServerErrorResponseError({
        error: Oauth2ErrorCodes.InvalidCredentialRequest,
        error_description: `Using unsupported 'credential_identifier'`,
      })
    }

    if (credentialRequest.format && !format) {
      throw new Oauth2ServerErrorResponseError({
        error: Oauth2ErrorCodes.UnsupportedCredentialFormat,
        error_description: `Unsupported credential request based on format '${credentialRequest.format}'`,
      })
    }

    if (parsedCredentialRequest.credentialConfigurationId && !parsedCredentialRequest.credentialConfiguration) {
      throw new Oauth2ServerErrorResponseError({
        error: Oauth2ErrorCodes.UnsupportedCredentialFormat,
        error_description: `Unsupported credential request based on credential configuration id ${credentialRequest.credential_configuration_id}`,
      })
    }

    const { credentialConfiguration, credentialConfigurationId } = this.getCredentialConfigurationsForRequest({
      issuanceSession,
      issuerMetadata,
      requestFormat: format,
      credentialConfigurations:
        parsedCredentialRequest.credentialConfiguration && parsedCredentialRequest.credentialConfigurationId
          ? {
              [parsedCredentialRequest.credentialConfigurationId]: parsedCredentialRequest.credentialConfiguration,
            }
          : undefined,
      authorization: options.authorization,
    })

    const verifiedCredentialRequestProofs = await this.verifyCredentialRequestProofs(agentContext, {
      issuanceSession,
      issuer,
      parsedCredentialRequest,
      credentialConfiguration,
      credentialConfigurationId,
    })

    const signedCredentials = await this.getSignedCredentials(agentContext, {
      credentialRequest,
      issuanceSession,
      issuer,
      credentialConfiguration,
      credentialConfigurationId,
      requestFormat: format,
      authorization: options.authorization,
      credentialRequestToCredentialMapper: options.credentialRequestToCredentialMapper,
      credentialRequestProofs: verifiedCredentialRequestProofs,
    })

    // NOTE: nonce in credential response is deprecated in newer drafts, but for now we keep it in
    const { cNonce, cNonceExpiresInSeconds } = await this.createNonce(agentContext, issuer)
    const credentialResponse = vcIssuer.createCredentialResponse({
      credential: credentialRequest.proof ? signedCredentials.credentials[0] : undefined,
      credentials: credentialRequest.proofs ? signedCredentials.credentials : undefined,
      cNonce,
      cNonceExpiresInSeconds,
      credentialRequest: parsedCredentialRequest,
    })

    issuanceSession.issuedCredentials.push(credentialConfigurationId)
    const newState =
      issuanceSession.issuedCredentials.length >=
      issuanceSession.credentialOfferPayload.credential_configuration_ids.length
        ? OpenId4VcIssuanceSessionState.Completed
        : OpenId4VcIssuanceSessionState.CredentialsPartiallyIssued
    await this.updateState(agentContext, issuanceSession, newState)

    return {
      credentialResponse,
      issuanceSession,
    }
  }

  private async verifyCredentialRequestProofs(
    agentContext: AgentContext,
    options: {
      parsedCredentialRequest: ParseCredentialRequestReturn
      issuer: OpenId4VcIssuerRecord
      issuanceSession: OpenId4VcIssuanceSessionRecord
      credentialConfigurationId: string
      credentialConfiguration: CredentialConfigurationSupportedWithFormats
    }
  ): Promise<VerifiedOpenId4VcCredentialHolderBinding> {
    const { parsedCredentialRequest, issuer, issuanceSession, credentialConfiguration, credentialConfigurationId } =
      options
    const { proofs } = parsedCredentialRequest

    const vcIssuer = this.getIssuer(agentContext, { issuanceSessionId: issuanceSession.id })
    const issuerMetadata = await this.getIssuerMetadata(agentContext, issuer)

    // FIXME: verify request against the configuration
    // - key attestations required
    // - proof types supported
    // - signing alg values supported
    // - key attestation level met.

    const allowedProofTypes = credentialConfiguration.proof_types_supported ?? {
      jwt: { proof_signing_alg_values_supported: getSupportedJwaSignatureAlgorithms(agentContext) },
    }

    const [proofType, proofValue] = (Object.entries(proofs ?? {})[0] as [string, string[]] | undefined) ?? []
    if (!proofType || !proofValue || proofValue.length === 0) {
      const { cNonce, cNonceExpiresInSeconds } = await this.createNonce(agentContext, issuer)
      throw new Oauth2ServerErrorResponseError({
        error: Oauth2ErrorCodes.InvalidProof,
        error_description: 'Missing required proof(s) in credential request',
        c_nonce: cNonce,
        c_nonce_expires_in: cNonceExpiresInSeconds,
      })
    }

    if (proofType !== 'jwt' && proofType !== 'attestation') {
      throw new Oauth2ServerErrorResponseError({
        error: Oauth2ErrorCodes.InvalidProof,
        error_description: `Proof type '${proofType}' is not supported `,
      })
    }

    const supportedProofType = allowedProofTypes[proofType]
    if (!supportedProofType) {
      throw new Oauth2ServerErrorResponseError({
        error: Oauth2ErrorCodes.InvalidProof,
        error_description: `Proof type '${proofType}' is not supported for credential configuration '${credentialConfigurationId}'`,
      })
    }

    if (proofType === 'attestation' && proofValue.length !== 1) {
      throw new Oauth2ServerErrorResponseError({
        error: Oauth2ErrorCodes.InvalidProof,
        error_description: "Only a single proofs entry is supported for proof type 'attestation'",
      })
    }

    await this.updateState(agentContext, issuanceSession, OpenId4VcIssuanceSessionState.CredentialRequestReceived)

    if (proofType === 'attestation') {
      const keyAttestationJwt = proofValue[0]
      const keyAttestation = await vcIssuer.verifyCredentialRequestAttestationProof({
        issuerMetadata,
        keyAttestationJwt,
      })

      if (!supportedProofType.proof_signing_alg_values_supported.includes(keyAttestation.header.alg)) {
        throw new Oauth2ServerErrorResponseError({
          error: Oauth2ErrorCodes.InvalidProof,
          error_description: `Proof signing alg value '${keyAttestation.header.alg}' is not supported for proof type 'attestation' in credentail configuration '${credentialConfigurationId}'`,
        })
      }

      if (!keyAttestation.payload.nonce) {
        const { cNonce, cNonceExpiresInSeconds } = await this.createNonce(agentContext, issuer)
        throw new Oauth2ServerErrorResponseError({
          error: Oauth2ErrorCodes.InvalidProof,
          error_description:
            'Missing nonce in attestation proof in credential request. If no nonce is present in the attestation, use the jwt proof type instead',
          c_nonce: cNonce,
          c_nonce_expires_in: cNonceExpiresInSeconds,
        })
      }

      if (supportedProofType.key_attestations_required && keyAttestation) {
        const expectedKeyStorage = supportedProofType.key_attestations_required.key_storage
        const expectedUserAuthentication = supportedProofType.key_attestations_required.user_authentication

        if (
          expectedKeyStorage &&
          !expectedKeyStorage.some((keyStorage) => keyAttestation.payload.key_storage?.includes(keyStorage))
        ) {
          throw new Oauth2ServerErrorResponseError({
            error: Oauth2ErrorCodes.InvalidProof,
            error_description: `Insufficent key_storage for key attestation. Proof type 'attestation' for credential configuration '${credentialConfigurationId}', expects one of key_storage values ${expectedKeyStorage.join(', ')}`,
          })
        }

        if (
          expectedUserAuthentication &&
          !expectedUserAuthentication.some((userAuthentication) =>
            keyAttestation.payload.user_authentication?.includes(userAuthentication)
          )
        ) {
          throw new Oauth2ServerErrorResponseError({
            error: Oauth2ErrorCodes.InvalidProof,
            error_description: `Insufficent user_authentication for key attestation. Proof type 'attestation' for credential configuration '${credentialConfigurationId}', expects one of user_authentication values ${expectedUserAuthentication.join(', ')}`,
          })
        }
      }

      await this.verifyNonce(agentContext, issuer, keyAttestation.payload.nonce).catch(async (error) => {
        const { cNonce, cNonceExpiresInSeconds } = await this.createNonce(agentContext, issuer)
        throw new Oauth2ServerErrorResponseError(
          {
            error: Oauth2ErrorCodes.InvalidNonce,
            error_description: 'Invalid nonce in credential request',
            c_nonce: cNonce,
            c_nonce_expires_in: cNonceExpiresInSeconds,
          },
          {
            cause: error,
          }
        )
      })

      return {
        bindingMethod: 'jwk',
        keys: keyAttestation.payload.attested_keys.map((attestedKey) => {
          const jwk = getJwkFromJson(attestedKey)
          return {
            method: 'jwk',
            jwk,
            key: jwk.key,
          }
        }),
        proofType: 'attestation',

        // It's up to the credential request mapper to ensure we trust the key attestation signer
        // For x5c it's kinda covered already.
        keyAttestation,
      }
    }

    if (proofType === 'jwt') {
      let firstNonce: string | undefined = undefined
      const proofSigners: Array<(JwtSignerWithJwk & { method: 'did' }) | JwtSignerJwk> = []

      for (const jwt of proofValue) {
        const { signer, payload, header, keyAttestation } = await vcIssuer.verifyCredentialRequestJwtProof({
          issuerMetadata,
          jwt,
          clientId: options.issuanceSession.clientId,
        })

        // TOOD: we should probably do this check before signature verification, but we then we
        // first need to decode the jwt
        if (!supportedProofType.proof_signing_alg_values_supported.includes(header.alg)) {
          throw new Oauth2ServerErrorResponseError({
            error: Oauth2ErrorCodes.InvalidProof,
            error_description: `Proof signing alg value '${header.alg}' is not supported for proof type 'jwt' in credentail configuration '${credentialConfigurationId}'`,
          })
        }

        if (signer.method !== 'jwk' && signer.method !== 'did') {
          throw new Oauth2ServerErrorResponseError({
            error: Oauth2ErrorCodes.InvalidProof,
            error_description: "Only 'jwk' and 'did' binding methods supported for jwt proof",
          })
        }

        if (proofSigners[0] && signer.method !== proofSigners[0].method) {
          throw new Oauth2ServerErrorResponseError({
            error: Oauth2ErrorCodes.InvalidProof,
            error_description:
              "All proofs must be signed using the same binding method. Found a mix of 'did' and 'jwk'",
          })
        }

        if (proofSigners[0] && signer.alg !== proofSigners[0].alg) {
          throw new Oauth2ServerErrorResponseError({
            error: Oauth2ErrorCodes.InvalidProof,
            error_description:
              "All proofs must be signed using the same alg value. Found a mix of different 'alg' values.",
          })
        }

        if (keyAttestation && signer.method === 'did') {
          throw new Oauth2ServerErrorResponseError({
            error: Oauth2ErrorCodes.InvalidProof,
            error_description: "Binding method 'did' is not supported when a key attestation is provided.",
          })
        }

        if (supportedProofType.key_attestations_required && !keyAttestation) {
          throw new Oauth2ServerErrorResponseError({
            error: Oauth2ErrorCodes.InvalidProof,
            error_description: `Missing required key attestation. Key attestations are required for proof type 'jwt' in credentail configuration '${credentialConfigurationId}'`,
          })
        }

        if (supportedProofType.key_attestations_required && keyAttestation) {
          const expectedKeyStorage = supportedProofType.key_attestations_required.key_storage
          const expectedUserAuthentication = supportedProofType.key_attestations_required.user_authentication

          if (
            expectedKeyStorage &&
            !expectedKeyStorage.some((keyStorage) => keyAttestation.payload.key_storage?.includes(keyStorage))
          ) {
            throw new Oauth2ServerErrorResponseError({
              error: Oauth2ErrorCodes.InvalidProof,
              error_description: `Insufficent key_storage for key attestation. Proof type 'jwt' for credential configuration '${credentialConfigurationId}', expects one of key_storage values ${expectedKeyStorage.join(', ')}`,
            })
          }

          if (
            expectedUserAuthentication &&
            !expectedUserAuthentication.some((userAuthentication) =>
              keyAttestation.payload.user_authentication?.includes(userAuthentication)
            )
          ) {
            throw new Oauth2ServerErrorResponseError({
              error: Oauth2ErrorCodes.InvalidProof,
              error_description: `Insufficent user_authentication for key attestation. Proof type 'jwt' for credential configuration '${credentialConfigurationId}', expects one of user_authentication values ${expectedUserAuthentication.join(', ')}`,
            })
          }
        }

        if (keyAttestation && proofValue.length > 1) {
          throw new Oauth2ServerErrorResponseError({
            error: Oauth2ErrorCodes.InvalidProof,
            error_description:
              "Only a single proofs entry is supported when jwt proof header contains  'key_attestation'",
          })
        }

        if (!payload.nonce) {
          const { cNonce, cNonceExpiresInSeconds } = await this.createNonce(agentContext, issuer)
          throw new Oauth2ServerErrorResponseError({
            error: Oauth2ErrorCodes.InvalidProof,
            error_description: 'Missing nonce in proof(s) in credential request',
            c_nonce: cNonce,
            c_nonce_expires_in: cNonceExpiresInSeconds,
          })
        }

        // Set previous nonce if not yet set (first iteration)
        if (!firstNonce) firstNonce = payload.nonce
        if (firstNonce !== payload.nonce) {
          const { cNonce, cNonceExpiresInSeconds } = await this.createNonce(agentContext, issuer)
          throw new Oauth2ServerErrorResponseError({
            error: Oauth2ErrorCodes.InvalidProof,
            error_description: 'Not all nonce values in proofs are equal',
            c_nonce: cNonce,
            c_nonce_expires_in: cNonceExpiresInSeconds,
          })
        }

        // Verify the nonce
        await this.verifyNonce(agentContext, issuer, payload.nonce).catch(async (error) => {
          const { cNonce, cNonceExpiresInSeconds } = await this.createNonce(agentContext, issuer)
          throw new Oauth2ServerErrorResponseError(
            {
              error: Oauth2ErrorCodes.InvalidNonce,
              error_description: 'Invalid nonce in credential request',
              c_nonce: cNonce,
              c_nonce_expires_in: cNonceExpiresInSeconds,
            },
            {
              cause: error,
            }
          )
        })

        if (keyAttestation) {
          return {
            proofType: 'jwt',
            bindingMethod: 'jwk',
            keys: keyAttestation.payload.attested_keys.map((attestedKey) => {
              const jwk = getJwkFromJson(attestedKey)
              return {
                method: 'jwk',
                jwk,
                key: jwk.key,
              }
            }),
            keyAttestation,
          }
        }
        proofSigners.push(signer)
      }

      if (proofSigners[0].method === 'did') {
        const signers = proofSigners as Array<JwtSignerWithJwk & { method: 'did' }>
        return {
          proofType: 'jwt',
          bindingMethod: 'did',
          keys: signers.map((signer) => ({
            didUrl: signer.didUrl,
            method: 'did',
            key: getJwkFromJson(signer.publicJwk).key,
          })),
        }
      }

      return {
        proofType: 'jwt',
        bindingMethod: 'jwk',
        keys: (proofSigners as JwtSignerJwk[]).map((signer) => {
          const jwk = getJwkFromJson(signer.publicJwk)
          return {
            method: 'jwk',
            jwk,
            key: jwk.key,
          }
        }),
      }
    }

    // This will not happen, but to make TS happy
    throw new Oauth2ServerErrorResponseError({
      error: Oauth2ErrorCodes.InvalidProof,
      error_description: 'Missing required proof(s) in credential request',
    })
  }

  public async findIssuanceSessionsByQuery(
    agentContext: AgentContext,
    query: Query<OpenId4VcIssuanceSessionRecord>,
    queryOptions?: QueryOptions
  ) {
    return this.openId4VcIssuanceSessionRepository.findByQuery(agentContext, query, queryOptions)
  }

  public async findSingleIssuancSessionByQuery(
    agentContext: AgentContext,
    query: Query<OpenId4VcIssuanceSessionRecord>
  ) {
    return this.openId4VcIssuanceSessionRepository.findSingleByQuery(agentContext, query)
  }

  public async getIssuanceSessionById(agentContext: AgentContext, issuanceSessionId: string) {
    return this.openId4VcIssuanceSessionRepository.getById(agentContext, issuanceSessionId)
  }

  public async getAllIssuers(agentContext: AgentContext) {
    return this.openId4VcIssuerRepository.getAll(agentContext)
  }

  public async getIssuerByIssuerId(agentContext: AgentContext, issuerId: string) {
    return this.openId4VcIssuerRepository.getByIssuerId(agentContext, issuerId)
  }

  public async updateIssuer(agentContext: AgentContext, issuer: OpenId4VcIssuerRecord) {
    return this.openId4VcIssuerRepository.update(agentContext, issuer)
  }

  public async createIssuer(agentContext: AgentContext, options: OpenId4VciCreateIssuerOptions) {
    // TODO: ideally we can store additional data with a key, such as:
    // - createdAt
    // - purpose
    const accessTokenSignerKey = await agentContext.wallet.createKey({
      keyType: options.accessTokenSignerKeyType ?? KeyType.Ed25519,
    })

    const openId4VcIssuer = new OpenId4VcIssuerRecord({
      issuerId: options.issuerId ?? utils.uuid(),
      display: options.display,
      dpopSigningAlgValuesSupported: options.dpopSigningAlgValuesSupported,
      accessTokenPublicKeyFingerprint: accessTokenSignerKey.fingerprint,
      authorizationServerConfigs: options.authorizationServerConfigs,
      credentialConfigurationsSupported: options.credentialConfigurationsSupported,
      batchCredentialIssuance: options.batchCredentialIssuance,
    })

    await this.openId4VcIssuerRepository.save(agentContext, openId4VcIssuer)
    await storeActorIdForContextCorrelationId(agentContext, openId4VcIssuer.issuerId)
    return openId4VcIssuer
  }

  public async rotateAccessTokenSigningKey(
    agentContext: AgentContext,
    issuer: OpenId4VcIssuerRecord,
    options?: Pick<OpenId4VciCreateIssuerOptions, 'accessTokenSignerKeyType'>
  ) {
    const accessTokenSignerKey = await agentContext.wallet.createKey({
      keyType: options?.accessTokenSignerKeyType ?? KeyType.Ed25519,
    })

    // TODO: ideally we can remove the previous key
    issuer.accessTokenPublicKeyFingerprint = accessTokenSignerKey.fingerprint
    await this.openId4VcIssuerRepository.update(agentContext, issuer)
  }

  /**
   * @param fetchExternalAuthorizationServerMetadata defaults to false
   */
  public async getIssuerMetadata(
    agentContext: AgentContext,
    issuerRecord: OpenId4VcIssuerRecord,
    fetchExternalAuthorizationServerMetadata = false
  ): Promise<OpenId4VciMetadata> {
    const config = agentContext.dependencyManager.resolve(OpenId4VcIssuerModuleConfig)
    const issuerUrl = joinUriParts(config.baseUrl, [issuerRecord.issuerId])
    const oauth2Client = this.getOauth2Client(agentContext)

    const extraAuthorizationServers: AuthorizationServerMetadata[] =
      fetchExternalAuthorizationServerMetadata && issuerRecord.authorizationServerConfigs
        ? await Promise.all(
            issuerRecord.authorizationServerConfigs.map(async (server) => {
              const metadata = await oauth2Client.fetchAuthorizationServerMetadata(server.issuer)
              if (!metadata)
                throw new CredoError(`Authorization server metadata not found for issuer '${server.issuer}'`)
              return metadata
            })
          )
        : []

    const authorizationServers =
      issuerRecord.authorizationServerConfigs && issuerRecord.authorizationServerConfigs.length > 0
        ? [
            ...issuerRecord.authorizationServerConfigs.map((authorizationServer) => authorizationServer.issuer),
            // Our issuer is also a valid authorization server (only for pre-auth)
            issuerUrl,
          ]
        : undefined

    const credentialIssuerMetadata = {
      credential_issuer: issuerUrl,
      credential_endpoint: joinUriParts(issuerUrl, [config.credentialEndpointPath]),
      credential_configurations_supported: issuerRecord.credentialConfigurationsSupported ?? {},
      authorization_servers: authorizationServers,
      display: issuerRecord.display,
      nonce_endpoint: joinUriParts(issuerUrl, [config.nonceEndpointPath]),
      batch_credential_issuance: issuerRecord.batchCredentialIssuance
        ? {
            batch_size: issuerRecord.batchCredentialIssuance.batchSize,
          }
        : undefined,
    } satisfies CredentialIssuerMetadata

    const issuerAuthorizationServer = {
      issuer: issuerUrl,
      token_endpoint: joinUriParts(issuerUrl, [config.accessTokenEndpointPath]),
      'pre-authorized_grant_anonymous_access_supported': true,

      jwks_uri: joinUriParts(issuerUrl, [config.jwksEndpointPath]),
      authorization_challenge_endpoint: joinUriParts(issuerUrl, [config.authorizationChallengeEndpointPath]),

      // TODO: PAR (maybe not needed as we only use this auth server for presentation during issuance)
      // pushed_authorization_request_endpoint: '',
      // require_pushed_authorization_requests: true

      code_challenge_methods_supported: [PkceCodeChallengeMethod.S256],
      dpop_signing_alg_values_supported: issuerRecord.dpopSigningAlgValuesSupported,
    } satisfies AuthorizationServerMetadata

    return {
      credentialIssuer: credentialIssuerMetadata,
      authorizationServers: [issuerAuthorizationServer, ...extraAuthorizationServers],
    }
  }

  public async createNonce(agentContext: AgentContext, issuer: OpenId4VcIssuerRecord) {
    const issuerMetadata = await this.getIssuerMetadata(agentContext, issuer)
    const jwsService = agentContext.dependencyManager.resolve(JwsService)

    const cNonceExpiresInSeconds = this.openId4VcIssuerConfig.cNonceExpiresInSeconds
    const cNonceExpiresAt = addSecondsToDate(new Date(), cNonceExpiresInSeconds)

    const key = Key.fromFingerprint(issuer.accessTokenPublicKeyFingerprint)
    const jwk = getJwkFromKey(key)

    const cNonce = await jwsService.createJwsCompact(agentContext, {
      key,
      payload: JwtPayload.fromJson({
        iss: issuerMetadata.credentialIssuer.credential_issuer,
        exp: dateToSeconds(cNonceExpiresAt),
      }),
      protectedHeaderOptions: {
        typ: 'credo+cnonce',
        kid: issuer.accessTokenPublicKeyFingerprint,
        alg: jwk.supportedSignatureAlgorithms[0],
      },
    })

    return {
      cNonce,
      cNonceExpiresAt,
      cNonceExpiresInSeconds,
    }
  }

  /**
   * @todo nonces are very short lived (1 min), but it might be nice to also cache the nonces
   * in the cache if we have 'seen' them. They will only be in the cache for a short time
   * and it will prevent replay
   */
  private async verifyNonce(agentContext: AgentContext, issuer: OpenId4VcIssuerRecord, cNonce: string) {
    const issuerMetadata = await this.getIssuerMetadata(agentContext, issuer)
    const jwsService = agentContext.dependencyManager.resolve(JwsService)

    const key = Key.fromFingerprint(issuer.accessTokenPublicKeyFingerprint)
    const jwk = getJwkFromKey(key)

    const jwt = Jwt.fromSerializedJwt(cNonce)
    jwt.payload.validate()

    if (jwt.payload.iss !== issuerMetadata.credentialIssuer.credential_issuer) {
      throw new CredoError(`Invalid 'iss' claim in cNonce jwt`)
    }
    if (jwt.header.typ !== 'credo+cnonce') {
      throw new CredoError(`Invalid 'typ' claim in cNonce jwt header`)
    }

    const verification = await jwsService.verifyJws(agentContext, {
      jws: cNonce,
      jwsSigner: {
        method: 'jwk',
        jwk,
      },
    })

    if (!verification.isValid) {
      throw new CredoError('Invalid nonce')
    }
  }

  public getIssuer(agentContext: AgentContext, options: { issuanceSessionId?: string } = {}) {
    return new Openid4vciIssuer({
      callbacks: getOid4vcCallbacks(agentContext, options),
    })
  }

  public getOauth2Client(agentContext: AgentContext) {
    return new Oauth2Client({
      callbacks: getOid4vcCallbacks(agentContext),
    })
  }

  public getOauth2AuthorizationServer(agentContext: AgentContext, options: { issuanceSessionId?: string } = {}) {
    return new Oauth2AuthorizationServer({
      callbacks: getOid4vcCallbacks(agentContext, options),
    })
  }

  public getResourceServer(agentContext: AgentContext, issuerRecord: OpenId4VcIssuerRecord) {
    return new Oauth2ResourceServer({
      callbacks: {
        ...getOid4vcCallbacks(agentContext),
        clientAuthentication: dynamicOid4vciClientAuthentication(agentContext, issuerRecord),
      },
    })
  }

  /**
   * Update the record to a new state and emit an state changed event. Also updates the record
   * in storage.
   */
  public async updateState(
    agentContext: AgentContext,
    issuanceSession: OpenId4VcIssuanceSessionRecord,
    newState: OpenId4VcIssuanceSessionState
  ) {
    agentContext.config.logger.debug(
      `Updating openid4vc issuance session record ${issuanceSession.id} to state ${newState} (previous=${issuanceSession.state})`
    )

    const previousState = issuanceSession.state
    issuanceSession.state = newState
    await this.openId4VcIssuanceSessionRepository.update(agentContext, issuanceSession)

    this.emitStateChangedEvent(agentContext, issuanceSession, previousState)
  }

  public emitStateChangedEvent(
    agentContext: AgentContext,
    issuanceSession: OpenId4VcIssuanceSessionRecord,
    previousState: OpenId4VcIssuanceSessionState | null
  ) {
    const eventEmitter = agentContext.dependencyManager.resolve(EventEmitter)

    eventEmitter.emit<OpenId4VcIssuanceSessionStateChangedEvent>(agentContext, {
      type: OpenId4VcIssuerEvents.IssuanceSessionStateChanged,
      payload: {
        issuanceSession: issuanceSession.clone(),
        previousState: previousState,
      },
    })
  }

  private async getGrantsFromConfig(
    agentContext: AgentContext,
    config: {
      issuerMetadata: OpenId4VciMetadata
      preAuthorizedCodeFlowConfig?: OpenId4VciPreAuthorizedCodeFlowConfig
      authorizationCodeFlowConfig?: OpenId4VciAuthorizationCodeFlowConfig
    }
  ) {
    const { preAuthorizedCodeFlowConfig, authorizationCodeFlowConfig, issuerMetadata } = config

    // TOOD: export type
    const grants: Parameters<Openid4vciIssuer['createCredentialOffer']>[0]['grants'] = {}

    // Pre auth
    if (preAuthorizedCodeFlowConfig) {
      const { txCode, authorizationServerUrl, preAuthorizedCode } = preAuthorizedCodeFlowConfig

      grants[preAuthorizedCodeGrantIdentifier] = {
        'pre-authorized_code': preAuthorizedCode ?? (await agentContext.wallet.generateNonce()),
        tx_code: txCode,
        authorization_server: config.issuerMetadata.credentialIssuer.authorization_servers
          ? authorizationServerUrl
          : undefined,
      }
    }

    // Auth
    if (authorizationCodeFlowConfig) {
      const { requirePresentationDuringIssuance } = authorizationCodeFlowConfig
      let authorizationServerUrl = authorizationCodeFlowConfig.authorizationServerUrl

      if (requirePresentationDuringIssuance) {
        if (authorizationServerUrl && authorizationServerUrl !== issuerMetadata.credentialIssuer.credential_issuer) {
          throw new CredoError(
            `When 'requirePresentationDuringIssuance' is set, 'authorizationServerUrl' must be undefined or match the credential issuer identifier`
          )
        }

        authorizationServerUrl = issuerMetadata.credentialIssuer.credential_issuer
      }

      grants.authorization_code = {
        issuer_state:
          // TODO: the issuer_state should not be guessable, so it's best if we generate it and now allow the user to provide it?
          // but same is true for the pre-auth code and users of credo can also provide that value. We can't easily do unique constraint with askat
          authorizationCodeFlowConfig.issuerState ??
          TypedArrayEncoder.toBase64URL(agentContext.wallet.getRandomValues(32)),
        authorization_server: config.issuerMetadata.credentialIssuer.authorization_servers
          ? authorizationServerUrl
          : undefined,
      }
    }

    return grants
  }

  private getCredentialConfigurationsForRequest(options: {
    issuerMetadata: OpenId4VciMetadata
    issuanceSession: OpenId4VcIssuanceSessionRecord
    authorization: OpenId4VciCredentialRequestAuthorization
    requestFormat?: CredentialRequestFormatSpecific
    credentialConfigurations?: CredentialConfigurationsSupportedWithFormats
  }): { credentialConfigurationId: string; credentialConfiguration: CredentialConfigurationSupportedWithFormats } {
    const { requestFormat, issuanceSession, issuerMetadata, authorization, credentialConfigurations } = options

    // Check against all credential configurations
    const configurationsMatchingRequest = credentialConfigurations
      ? credentialConfigurations
      : requestFormat
        ? getCredentialConfigurationsMatchingRequestFormat({
            requestFormat,
            credentialConfigurations: issuerMetadata.credentialIssuer.credential_configurations_supported,
          })
        : undefined

    if (!configurationsMatchingRequest) {
      throw new Oauth2ServerErrorResponseError({
        error: Oauth2ErrorCodes.InvalidCredentialRequest,
        error_description: `Either 'credential_configuration_id' or 'format' needs to be defined'`,
      })
    }

    if (Object.keys(configurationsMatchingRequest).length === 0) {
      throw new Oauth2ServerErrorResponseError({
        error: Oauth2ErrorCodes.InvalidCredentialRequest,
        error_description: 'Credential request does not match any credential configuration',
      })
    }

    // Limit to offered configurations
    const configurationsMatchingRequestAndOffer = getOfferedCredentials(
      issuanceSession.credentialOfferPayload.credential_configuration_ids,
      configurationsMatchingRequest,
      { ignoreNotFoundIds: true }
    )
    if (Object.keys(configurationsMatchingRequestAndOffer).length === 0) {
      throw new Oauth2ServerErrorResponseError({
        error: Oauth2ErrorCodes.InvalidCredentialRequest,
        error_description: 'Credential request does not match any credential configurations from credential offer',
      })
    }

    // Limit to not-issued configurations
    const configurationsMatchingRequestAndOfferNotIssued = getOfferedCredentials(
      issuanceSession.credentialOfferPayload.credential_configuration_ids.filter(
        (id) => !issuanceSession.issuedCredentials.includes(id)
      ),
      configurationsMatchingRequestAndOffer,
      { ignoreNotFoundIds: true }
    )
    if (Object.keys(configurationsMatchingRequestAndOfferNotIssued).length === 0) {
      throw new Oauth2ServerErrorResponseError({
        error: Oauth2ErrorCodes.InvalidCredentialRequest,
        error_description:
          'Credential request does not match any credential configurations from credential offer that have not been issued yet',
      })
    }

    // For pre-auth we allow all ids from the offer
    if (authorization.accessToken.payload['pre-authorized_code']) {
      // We return the first one that matches all checks. Pre draft 15 it could be multiple entries, but only if you offer
      // multiple credentials of the same type. We need to do checks on this, so we pick the first one
      const [credentialConfigurationId, credentialConfiguration] = Object.entries(
        configurationsMatchingRequestAndOfferNotIssued
      )[0]
      return {
        credentialConfigurationId,
        credentialConfiguration,
      }
    }

    // Limit to scopes from the token
    // We only do this for auth flow, so it's not required to add a scope for every configuration.
    const configurationsMatchingRequestOfferScope = getCredentialConfigurationsSupportedForScopes(
      configurationsMatchingRequestAndOfferNotIssued,
      authorization.accessToken.payload.scope?.split(' ') ?? []
    )
    if (Object.keys(configurationsMatchingRequestOfferScope).length === 0) {
      throw new Oauth2ServerErrorResponseError(
        {
          error: Oauth2ErrorCodes.InsufficientScope,
          error_description:
            'Scope does not grant issuance for any requested credential configurations from credential offer',
        },
        {
          status: 403,
        }
      )
    }

    // We return the first one that matches all checks. Pre draft 15 it could be multiple entries, but only if you offer
    // multiple credentials of the same type. We need to do checks on this, so we pick the first one
    const [credentialConfigurationId, credentialConfiguration] = Object.entries(
      configurationsMatchingRequestOfferScope
    )[0]
    return {
      credentialConfigurationId,
      credentialConfiguration: credentialConfiguration as CredentialConfigurationSupportedWithFormats,
    }
  }

  private async getSignedCredentials(
    agentContext: AgentContext,
    options: OpenId4VciCreateCredentialResponseOptions & {
      issuer: OpenId4VcIssuerRecord
      issuanceSession: OpenId4VcIssuanceSessionRecord
      credentialConfiguration: OpenId4VciCredentialConfigurationSupportedWithFormats
      credentialConfigurationId: string
      requestFormat?: CredentialRequestFormatSpecific
      credentialRequestProofs: VerifiedOpenId4VcCredentialHolderBinding
    }
  ): Promise<{
    credentials: string[] | Record<string, unknown>[]
    format: `${OpenId4VciCredentialFormatProfile}`
  }> {
    const { issuanceSession, credentialConfiguration, credentialConfigurationId, credentialRequestProofs } = options

    const mapper =
      options.credentialRequestToCredentialMapper ?? this.openId4VcIssuerConfig.credentialRequestToCredentialMapper

    let verification: OpenId4VciCredentialRequestToCredentialMapperOptions['verification'] = undefined

    // NOTE: this will throw an error if the verifier module is not registered and there is a
    // verification session. But you can't get here without the verifier module anyway
    if (issuanceSession.presentation?.openId4VcVerificationSessionId) {
      const verifierApi = agentContext.dependencyManager.resolve(OpenId4VcVerifierApi)
      const session = await verifierApi.getVerificationSessionById(
        issuanceSession.presentation.openId4VcVerificationSessionId
      )

      const response = await verifierApi.getVerifiedAuthorizationResponse(
        issuanceSession.presentation.openId4VcVerificationSessionId
      )

      if (response.presentationExchange) {
        verification = {
          session,
          presentationExchange: response.presentationExchange,
        }
      } else if (response.dcql) {
        verification = {
          session,
          dcql: response.dcql,
        }
      } else {
        throw new CredoError(
          `Verified authorization response for verification session with id '${session.id}' does not have presenationExchange or dcql defined.`
        )
      }
    }

    const signOptions = await mapper({
      agentContext,
      issuanceSession,
      holderBinding: credentialRequestProofs,
      credentialOffer: issuanceSession.credentialOfferPayload,

      verification,

      credentialRequest: options.credentialRequest,
      credentialRequestFormat: options.requestFormat,

      // Macthing credential configuration
      credentialConfiguration,
      credentialConfigurationId,

      // Authorization
      authorization: options.authorization,
    })

    const expectedLength = credentialRequestProofs.keys.length
    // NOTE: we may want to allow a mismatch between this (as there is a match batch length), but for now it needs to match
    if (signOptions.credentials.length !== expectedLength) {
      throw new CredoError(
        `Credential request to credential mapper returned '${signOptions.credentials.length}' to be signed, while '${expectedLength}' holder binding entries were provided. Make sure to return one credential for each holder binding entry`
      )
    }

    if (signOptions.format === ClaimFormat.JwtVc || signOptions.format === ClaimFormat.LdpVc) {
      const oid4vciFormatMap: Record<string, ClaimFormat.JwtVc | ClaimFormat.LdpVc> = {
        [OpenId4VciCredentialFormatProfile.JwtVcJson]: ClaimFormat.JwtVc,
        [OpenId4VciCredentialFormatProfile.JwtVcJsonLd]: ClaimFormat.JwtVc,
        [OpenId4VciCredentialFormatProfile.LdpVc]: ClaimFormat.LdpVc,
      }

      const expectedClaimFormat = oid4vciFormatMap[credentialConfiguration.format]
      if (signOptions.format !== expectedClaimFormat) {
        throw new CredoError(
          `Invalid credential format returned by sign options. Expected '${expectedClaimFormat}', received '${signOptions.format}'.`
        )
      }

      return {
        format: credentialConfiguration.format,
        credentials: (await Promise.all(
          signOptions.credentials.map((credential) =>
            this.signW3cCredential(agentContext, signOptions.format, credential).then((signed) => signed.encoded)
          )
        )) as string[] | Record<string, unknown>[],
      }
    }
    if (signOptions.format === ClaimFormat.SdJwtVc) {
      if (
        credentialConfiguration.format !== OpenId4VciCredentialFormatProfile.SdJwtVc &&
        credentialConfiguration.format !== OpenId4VciCredentialFormatProfile.SdJwtDc
      ) {
        throw new CredoError(
          `Invalid credential format returned by sign options. Expected '${ClaimFormat.SdJwtVc}', received '${signOptions.format}'.`
        )
      }

      if (!signOptions.credentials.every((c) => c.payload.vct === credentialConfiguration.vct)) {
        throw new CredoError(
          `One or more vct values of the offered credential(s) do not match the vct of the requested credential. Offered ${Array.from(
            new Set(signOptions.credentials.map((c) => `'${c.payload.vct}'`))
          ).join(', ')} Requested '${credentialConfiguration.vct}'.`
        )
      }

      const sdJwtVcApi = agentContext.dependencyManager.resolve(SdJwtVcApi)
      return {
        format: credentialConfiguration.format,
        credentials: await Promise.all(
          signOptions.credentials.map((credential) => sdJwtVcApi.sign(credential).then((signed) => signed.compact))
        ),
      }
    }
    if (signOptions.format === ClaimFormat.MsoMdoc) {
      if (signOptions.format !== credentialConfiguration.format) {
        throw new CredoError(
          `Invalid credential format returned by sign options. Expected '${credentialConfiguration.format}', received '${signOptions.format}'.`
        )
      }
      if (!signOptions.credentials.every((c) => c.docType === credentialConfiguration.doctype)) {
        throw new CredoError(
          `One or more doctype values of the offered credential(s) do not match the doctype of the requested credential. Offered ${Array.from(
            new Set(signOptions.credentials.map((c) => `'${c.docType}'`))
          ).join(', ')} Requested '${credentialConfiguration.doctype}'.`
        )
      }

      const mdocApi = agentContext.dependencyManager.resolve(MdocApi)
      return {
        format: OpenId4VciCredentialFormatProfile.MsoMdoc,
        credentials: await Promise.all(
          signOptions.credentials.map((credential) => mdocApi.sign(credential).then((signed) => signed.base64Url))
        ),
      }
    }
    throw new CredoError(`Unsupported credential format ${signOptions.format}`)
  }

  private async signW3cCredential(
    agentContext: AgentContext,
    format: `${ClaimFormat.JwtVc}` | `${ClaimFormat.LdpVc}`,
    options: OpenId4VciSignW3cCredentials['credentials'][number]
  ) {
    const key = await getKeyFromDid(agentContext, options.verificationMethod)
    if (format === ClaimFormat.JwtVc) {
      const supportedSignatureAlgorithms = getJwkFromKey(key).supportedSignatureAlgorithms
      if (supportedSignatureAlgorithms.length === 0) {
        throw new CredoError(`No supported JWA signature algorithms found for key with keyType ${key.keyType}`)
      }

      const alg = supportedSignatureAlgorithms[0]
      if (!alg) {
        throw new CredoError(`No supported JWA signature algorithms for key type ${key.keyType}`)
      }

      return await this.w3cCredentialService.signCredential(agentContext, {
        format: ClaimFormat.JwtVc,
        credential: options.credential,
        verificationMethod: options.verificationMethod,
        alg,
      })
    }
    const proofType = getProofTypeFromKey(agentContext, key)

    return await this.w3cCredentialService.signCredential(agentContext, {
      format: ClaimFormat.LdpVc,
      credential: options.credential,
      verificationMethod: options.verificationMethod,
      proofType: proofType,
    })
  }
}
