import '@openwallet-foundation/askar-nodejs'
import type {
  AgentContext,
  KeyDidCreateOptions,
  VerificationMethod,
  W3cVerifiableCredential,
  W3cVerifyCredentialResult,
} from '@credo-ts/core'
import {
  Agent,
  asArray,
  CredoError,
  DidKey,
  DidsApi,
  equalsIgnoreOrder,
  JsonTransformer,
  JwsService,
  Jwt,
  JwtPayload,
  Kms,
  RecordNotFoundError,
  SdJwtVcApi,
  TypedArrayEncoder,
  utils,
  W3cCredential,
  W3cCredentialService,
  W3cCredentialSubject,
  W3cIssuer,
  W3cJsonLdVerifiableCredential,
  W3cJwtVerifiableCredential,
  W3cV2Credential,
  W3cV2CredentialService,
  W3cV2CredentialSubject,
  W3cV2Issuer,
  W3cV2SdJwtVerifiableCredential,
  w3cDate,
} from '@credo-ts/core'
import { InMemoryWalletModule } from '../../../../../tests/InMemoryWalletModule'
import { transformPrivateKeyToPrivateJwk } from '../../../../askar/src'
import { agentDependencies } from '../../../../node/src'
import { OpenId4VcModule } from '../../OpenId4VcModule'
import type {
  OpenId4VciCredentialConfigurationSupportedWithFormats,
  OpenId4VciCredentialRequest,
  OpenId4VciMetadata,
} from '../../shared'
import { OpenId4VciCredentialFormatProfile } from '../../shared'
import { OpenId4VcIssuanceSessionState } from '../OpenId4VcIssuanceSessionState'
import { OpenId4VcIssuerService } from '../OpenId4VcIssuerService'
import type { OpenId4VciCredentialRequestToCredentialMapper } from '../OpenId4VcIssuerServiceOptions'
import type { OpenId4VcIssuerRecord } from '../repository'
import { OpenId4VcIssuanceSessionRepository } from '../repository'

const openBadgeCredential = {
  id: 'openBadgeCredential',
  format: OpenId4VciCredentialFormatProfile.JwtVcJson,
  credential_definition: {
    type: ['VerifiableCredential', 'OpenBadgeCredential'],
  },
} satisfies OpenId4VciCredentialConfigurationSupportedWithFormats

const openBadgeCredentialSdJwtVc = {
  id: 'openBadgeCredentialSdJwtVc',
  format: OpenId4VciCredentialFormatProfile.SdJwtVc,
  credential_definition: {
    type: ['VerifiableCredential', 'OpenBadgeCredentialSdJwtVc'],
  },
} satisfies OpenId4VciCredentialConfigurationSupportedWithFormats

const universityDegreeCredential = {
  id: 'universityDegreeCredential',
  format: OpenId4VciCredentialFormatProfile.JwtVcJson,
  credential_definition: {
    type: ['VerifiableCredential', 'UniversityDegreeCredential'],
  },
} satisfies OpenId4VciCredentialConfigurationSupportedWithFormats

const universityDegreeCredentialLd = {
  id: 'universityDegreeCredentialLd',
  format: OpenId4VciCredentialFormatProfile.JwtVcJsonLd,
  credential_definition: {
    '@context': [],
    type: ['VerifiableCredential', 'UniversityDegreeCredential'],
  },
} satisfies OpenId4VciCredentialConfigurationSupportedWithFormats

const universityDegreeCredentialSdJwt = {
  id: 'universityDegreeCredentialSdJwt',
  format: OpenId4VciCredentialFormatProfile.SdJwtVc,
  vct: 'UniversityDegreeCredential',
} satisfies OpenId4VciCredentialConfigurationSupportedWithFormats

const modules = {
  openid4vc: new OpenId4VcModule({
    issuer: {
      baseUrl: 'https://openid4vc-issuer.com',
      credentialRequestToCredentialMapper: () => {
        throw new Error('Not implemented')
      },
    },
  }),
  inMemory: new InMemoryWalletModule(),
}

const jwsService = new JwsService()

const createCredentialRequest = async (
  agentContext: AgentContext,
  options: {
    issuerMetadata: OpenId4VciMetadata
    credentialConfiguration: OpenId4VciCredentialConfigurationSupportedWithFormats
    nonce: string
    kid: string
    clientId?: string // use with the authorization code flow,
  }
): Promise<OpenId4VciCredentialRequest> => {
  const { credentialConfiguration, kid, nonce, issuerMetadata, clientId } = options

  const didsApi = agentContext.dependencyManager.resolve(DidsApi)
  const { publicJwk } = await didsApi.resolveVerificationMethodFromCreatedDidRecord(kid)

  const jws = await jwsService.createJwsCompact(agentContext, {
    protectedHeaderOptions: { alg: publicJwk.signatureAlgorithm, kid, typ: 'openid4vci-proof+jwt' },
    payload: new JwtPayload({
      iat: utils.dateToSeconds(new Date()),
      iss: clientId,
      aud: issuerMetadata.credentialIssuer.credential_issuer,
      additionalClaims: {
        nonce,
      },
    }),
    keyId: publicJwk.keyId,
  })

  if (credentialConfiguration.format === OpenId4VciCredentialFormatProfile.JwtVcJson) {
    return { ...credentialConfiguration, proof: { jwt: jws, proof_type: 'jwt' } }
  }
  if (
    credentialConfiguration.format === OpenId4VciCredentialFormatProfile.JwtVcJsonLd ||
    credentialConfiguration.format === OpenId4VciCredentialFormatProfile.LdpVc
  ) {
    return {
      format: credentialConfiguration.format,
      credential_definition: {
        '@context': credentialConfiguration.credential_definition['@context'],
        types: credentialConfiguration.credential_definition.type,
      },

      proof: { jwt: jws, proof_type: 'jwt' },
    }
  }
  if (credentialConfiguration.format === OpenId4VciCredentialFormatProfile.SdJwtVc) {
    if (credentialConfiguration.credential_definition?.type) {
      return {
        format: credentialConfiguration.format,
        credential_definition: {
          '@context': credentialConfiguration.credential_definition['@context'],
          type: credentialConfiguration.credential_definition.type,
        },
        proof: { jwt: jws, proof_type: 'jwt' },
      }
    }

    return { ...credentialConfiguration, proof: { jwt: jws, proof_type: 'jwt' } }
  }

  throw new Error('Unsupported format')
}

const issuer = new Agent({
  config: {},
  dependencies: agentDependencies,
  modules,
})

const holder = new Agent({
  config: {},
  dependencies: agentDependencies,
  modules,
})

describe('OpenId4VcIssuer', () => {
  let issuerVerificationMethod: VerificationMethod
  let issuerDid: string
  let openId4VcIssuer: OpenId4VcIssuerRecord

  let holderKid: string
  let holderVerificationMethod: VerificationMethod
  let holderDid: string

  beforeEach(async () => {
    await issuer.initialize()
    await holder.initialize()

    const { keyId } = await holder.kms.importKey({
      privateJwk: transformPrivateKeyToPrivateJwk({
        privateKey: TypedArrayEncoder.fromUtf8String('96213c3d7fc8d4d6754c7a0fd969598e'),
        type: { kty: 'OKP', crv: 'Ed25519' },
      }).privateJwk,
    })

    const holderDidCreateResult = await holder.dids.create<KeyDidCreateOptions>({
      method: 'key',
      options: { keyId },
    })

    holderDid = holderDidCreateResult.didState.did as string
    const holderDidKey = DidKey.fromDid(holderDid)
    holderKid = `${holderDid}#${holderDidKey.publicJwk.fingerprint}`
    const _holderVerificationMethod = holderDidCreateResult.didState.didDocument?.dereferenceKey(holderKid, [
      'authentication',
    ])
    if (!_holderVerificationMethod) throw new Error('No verification method found')
    holderVerificationMethod = _holderVerificationMethod

    const { keyId: issuerKeyId } = await issuer.kms.importKey({
      privateJwk: transformPrivateKeyToPrivateJwk({
        privateKey: TypedArrayEncoder.fromUtf8String('96213c3d7fc8d4d6754c7a0fd969598f'),
        type: { kty: 'OKP', crv: 'Ed25519' },
      }).privateJwk,
    })
    const issuerDidCreateResult = await issuer.dids.create<KeyDidCreateOptions>({
      method: 'key',
      options: { keyId: issuerKeyId },
    })

    issuerDid = issuerDidCreateResult.didState.did as string

    const issuerDidKey = DidKey.fromDid(issuerDid)
    const issuerKid = `${issuerDid}#${issuerDidKey.publicJwk.fingerprint}`
    const _issuerVerificationMethod = issuerDidCreateResult.didState.didDocument?.dereferenceKey(issuerKid, [
      'authentication',
    ])
    if (!_issuerVerificationMethod) throw new Error('No verification method found')
    issuerVerificationMethod = _issuerVerificationMethod

    openId4VcIssuer = await issuer.openid4vc.issuer.createIssuer({
      credentialConfigurationsSupported: {
        openBadgeCredential,
        openBadgeCredentialSdJwtVc,
        universityDegreeCredential,
        universityDegreeCredentialLd,
        universityDegreeCredentialSdJwt,
      },
    })
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await issuer.shutdown()
    await holder.shutdown()
  })

  it('uses and persists the configured KMS backend for access token signing keys', async () => {
    const createKey = issuer.kms.createKey.bind(issuer.kms)
    const deleteKey = issuer.kms.deleteKey.bind(issuer.kms)
    const createKeySpy = vi
      .spyOn(issuer.kms, 'createKey')
      .mockImplementation(({ backend: _backend, ...options }) => createKey(options))
    const deleteKeySpy = vi
      .spyOn(issuer.kms, 'deleteKey')
      .mockImplementation(({ backend: _backend, ...options }) => deleteKey(options))

    const createdIssuer = await issuer.openid4vc.issuer.createIssuer({
      credentialConfigurationsSupported: { openBadgeCredential },
      accessTokenSignerKmsBackend: 'remote-kms-a',
    })

    expect(createKeySpy).toHaveBeenLastCalledWith({
      type: { kty: 'OKP', crv: 'Ed25519' },
      backend: 'remote-kms-a',
    })
    expect(createdIssuer.accessTokenSignerKmsBackend).toBe('remote-kms-a')

    const previousKeyId = createdIssuer.resolvedAccessTokenPublicJwk.keyId
    await issuer.openid4vc.issuer.rotateAccessTokenSigningKey(createdIssuer.issuerId, {
      accessTokenSignerKmsBackend: 'remote-kms-b',
    })

    expect(createKeySpy).toHaveBeenLastCalledWith({
      type: { kty: 'OKP', crv: 'Ed25519' },
      backend: 'remote-kms-b',
    })
    expect(deleteKeySpy).toHaveBeenLastCalledWith({ keyId: previousKeyId, backend: 'remote-kms-a' })
    expect(
      (await issuer.openid4vc.issuer.getIssuerByIssuerId(createdIssuer.issuerId)).accessTokenSignerKmsBackend
    ).toBe('remote-kms-b')
  })

  // This method is available on the holder service,
  // would be nice to reuse
  async function handleCredentialResponse(
    agentContext: AgentContext,
    credentialInResponse: string | Record<string, unknown> | undefined,
    credentialConfiguration: OpenId4VciCredentialConfigurationSupportedWithFormats
  ) {
    if (credentialConfiguration.format === 'vc+sd-jwt' && typeof credentialInResponse === 'string') {
      if (credentialConfiguration.credential_definition?.type) {
        const w3cVerifiableCredential = W3cV2SdJwtVerifiableCredential.fromCompact(credentialInResponse)
        const result = await holder.context.dependencyManager
          .resolve(W3cV2CredentialService)
          .verifyCredential(holder.context, { credential: w3cVerifiableCredential })

        if (!result.isValid) {
          holder.context.config.logger.error('Failed to validate credential', { result })
          throw new CredoError(`Failed to validate credential, error = ${result.error?.message ?? 'Unknown'}`)
        }

        if (
          equalsIgnoreOrder(
            asArray(w3cVerifiableCredential.resolvedCredential.type),
            credentialConfiguration.credential_definition.type
          ) === false
        ) {
          throw new Error('Invalid credential type')
        }

        return
      }

      const api = agentContext.dependencyManager.resolve(SdJwtVcApi)
      await api.verify({ compactSdJwtVc: credentialInResponse })
      return
    }

    const w3cCredentialService = holder.context.dependencyManager.resolve(W3cCredentialService)

    let result: W3cVerifyCredentialResult
    let w3cVerifiableCredential: W3cVerifiableCredential

    if (typeof credentialInResponse === 'string') {
      if (credentialConfiguration.format !== 'jwt_vc_json' && credentialConfiguration.format !== 'jwt_vc_json-ld') {
        throw new Error(`Invalid format. ${credentialConfiguration.format}`)
      }
      w3cVerifiableCredential = W3cJwtVerifiableCredential.fromSerializedJwt(credentialInResponse)
      result = await w3cCredentialService.verifyCredential(holder.context, { credential: w3cVerifiableCredential })
    } else if (credentialConfiguration.format === 'ldp_vc') {
      if (credentialConfiguration.format !== 'ldp_vc') throw new Error('Invalid format')
      // validate jwt credentials

      w3cVerifiableCredential = JsonTransformer.fromJSON(credentialInResponse, W3cJsonLdVerifiableCredential)
      result = await w3cCredentialService.verifyCredential(holder.context, { credential: w3cVerifiableCredential })
    } else {
      throw new CredoError('Unsupported credential format')
    }

    if (!result.isValid) {
      holder.context.config.logger.error('Failed to validate credential', { result })
      throw new CredoError(`Failed to validate credential, error = ${result.error?.message ?? 'Unknown'}`)
    }

    if (equalsIgnoreOrder(w3cVerifiableCredential.type, credentialConfiguration.credential_definition.type) === false) {
      throw new Error('Invalid credential type')
    }
    return w3cVerifiableCredential
  }

  it('pre authorized code flow (sd-jwt-vc)', async () => {
    const preAuthorizedCode = '1234567890'

    const result = await issuer.openid4vc.issuer.createCredentialOffer({
      issuerId: openId4VcIssuer.issuerId,
      credentialConfigurationIds: [universityDegreeCredentialSdJwt.id],
      preAuthorizedCodeFlowConfig: {
        preAuthorizedCode,
      },
    })

    const issuanceSessionRepository = issuer.context.dependencyManager.resolve(OpenId4VcIssuanceSessionRepository)
    const issuerService = issuer.context.dependencyManager.resolve(OpenId4VcIssuerService)
    await issuanceSessionRepository.update(issuer.context, result.issuanceSession)

    expect(result).toMatchObject({
      credentialOffer: expect.stringMatching(
        new RegExp(
          `^openid-credential-offer://\\?credential_offer_uri=https%3A%2F%2Fopenid4vc-issuer.com%2F${openId4VcIssuer.issuerId}%2Foffers%2F.*$`
        )
      ),
      issuanceSession: {
        credentialOfferPayload: {
          credential_issuer: `https://openid4vc-issuer.com/${openId4VcIssuer.issuerId}`,
          credential_configuration_ids: ['universityDegreeCredentialSdJwt'],
          grants: {
            'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
              'pre-authorized_code': '1234567890',
            },
          },
        },
      },
    })

    const { cNonce } = await issuerService.createNonce(issuer.context, openId4VcIssuer)
    const issuerMetadata = await issuer.openid4vc.issuer.getIssuerMetadata(openId4VcIssuer.issuerId)
    const credentialRequest = await createCredentialRequest(holder.context, {
      credentialConfiguration: universityDegreeCredentialSdJwt,
      issuerMetadata,
      kid: holderKid,
      nonce: cNonce,
    })

    // We need to update the state, as it is checked and we're skipping the access token step
    result.issuanceSession.state = OpenId4VcIssuanceSessionState.AccessTokenCreated
    await issuanceSessionRepository.update(issuer.context, result.issuanceSession)

    const { credentialResponse } = await issuer.openid4vc.issuer.createCredentialResponse({
      issuanceSessionId: result.issuanceSession.id,
      credentialRequest,
      authorization: {
        authorizationServer: 'https://authorization.com',
        accessToken: {
          payload: {
            active: true,
            sub: 'something',
            'pre-authorized_code': 'some',
          },
          value: 'the-access-token',
        },
      },

      credentialRequestToCredentialMapper: () => ({
        type: 'credentials',
        format: 'dc+sd-jwt',
        credentials: [
          {
            payload: { vct: 'UniversityDegreeCredential', university: 'innsbruck', degree: 'bachelor' },
            issuer: { method: 'did', didUrl: issuerVerificationMethod.id },
            holder: { method: 'did', didUrl: holderVerificationMethod.id },
            disclosureFrame: { _sd: ['university', 'degree'] },
          },
        ],
        credentialConfigurationId: universityDegreeCredentialSdJwt.id,
      }),
    })

    expect(credentialResponse).toEqual({
      c_nonce: expect.any(String),
      c_nonce_expires_in: 60,
      credential: expect.any(String),
      format: 'vc+sd-jwt',
      credentials: undefined,
      notification_id: undefined,
    })

    await handleCredentialResponse(holder.context, credentialResponse.credential, universityDegreeCredentialSdJwt)
  })

  it('pre authorized code flow (sd-jwt-vc) v13', async () => {
    const preAuthorizedCode = '1234567890'

    const result = await issuer.openid4vc.issuer.createCredentialOffer({
      issuerId: openId4VcIssuer.issuerId,
      credentialConfigurationIds: [universityDegreeCredentialSdJwt.id],
      preAuthorizedCodeFlowConfig: {
        preAuthorizedCode,
        txCode: {
          description: 'Transaction code',
          length: 8,
          input_mode: 'text',
        },
      },
      version: 'v1.draft15',
    })

    const issuanceSessionRepository = issuer.context.dependencyManager.resolve(OpenId4VcIssuanceSessionRepository)
    await issuanceSessionRepository.update(issuer.context, result.issuanceSession)

    expect(result).toMatchObject({
      credentialOffer: expect.stringMatching(
        new RegExp(
          `^openid-credential-offer://\\?credential_offer_uri=https%3A%2F%2Fopenid4vc-issuer.com%2F${openId4VcIssuer.issuerId}%2Foffers%2F.*$`
        )
      ),
      issuanceSession: {
        credentialOfferPayload: {
          credential_issuer: `https://openid4vc-issuer.com/${openId4VcIssuer.issuerId}`,
          credential_configuration_ids: ['universityDegreeCredentialSdJwt'],
          grants: {
            'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
              'pre-authorized_code': '1234567890',
              tx_code: {
                description: 'Transaction code',
                length: 8,
                input_mode: 'text',
              },
            },
          },
        },
      },
    })

    const issuerMetadata = await issuer.openid4vc.issuer.getIssuerMetadata(openId4VcIssuer.issuerId)

    const issuerService = issuer.context.dependencyManager.resolve(OpenId4VcIssuerService)
    const { cNonce } = await issuerService.createNonce(issuer.context, openId4VcIssuer)
    const credentialRequest = await createCredentialRequest(holder.context, {
      credentialConfiguration: universityDegreeCredentialSdJwt,
      issuerMetadata,
      kid: holderKid,
      nonce: cNonce,
    })

    // We need to update the state, as it is checked and we're skipping the access token step
    result.issuanceSession.state = OpenId4VcIssuanceSessionState.AccessTokenCreated
    await issuanceSessionRepository.update(issuer.context, result.issuanceSession)

    const { credentialResponse } = await issuer.openid4vc.issuer.createCredentialResponse({
      issuanceSessionId: result.issuanceSession.id,
      credentialRequest,
      authorization: {
        authorizationServer: 'https://authorization.com',
        accessToken: {
          payload: {
            active: true,
            sub: 'something',
            'pre-authorized_code': 'some',
          },
          value: 'the-access-token',
        },
      },

      credentialRequestToCredentialMapper: () => ({
        type: 'credentials',
        format: 'dc+sd-jwt',
        credentials: [
          {
            payload: { vct: 'UniversityDegreeCredential', university: 'innsbruck', degree: 'bachelor' },
            issuer: { method: 'did', didUrl: issuerVerificationMethod.id },
            holder: { method: 'did', didUrl: holderVerificationMethod.id },
            disclosureFrame: { _sd: ['university', 'degree'] },
          },
        ],
        credentialConfigurationId: universityDegreeCredentialSdJwt.id,
      }),
    })

    expect(credentialResponse).toEqual({
      c_nonce: expect.any(String),
      c_nonce_expires_in: 60,
      credential: expect.any(String),
      format: 'vc+sd-jwt', // Should not be present in v13, only for v11 compat
      credentials: undefined,
      notification_id: undefined,
    })

    await handleCredentialResponse(holder.context, credentialResponse.credential, universityDegreeCredentialSdJwt)
  })

  it('pre authorized code flow (jwt-vc-json)', async () => {
    const preAuthorizedCode = '1234567890'

    const result = await issuer.openid4vc.issuer.createCredentialOffer({
      issuerId: openId4VcIssuer.issuerId,
      credentialConfigurationIds: [openBadgeCredential.id],
      preAuthorizedCodeFlowConfig: {
        preAuthorizedCode,
      },
      issuanceMetadata: {
        myIssuance: 'metadata',
      },
    })

    const issuanceSessionRepository = issuer.context.dependencyManager.resolve(OpenId4VcIssuanceSessionRepository)
    result.issuanceSession.state = OpenId4VcIssuanceSessionState.AccessTokenCreated
    await issuanceSessionRepository.update(issuer.context, result.issuanceSession)

    expect(result.credentialOffer).toBeDefined()

    const issuerMetadata = await issuer.openid4vc.issuer.getIssuerMetadata(openId4VcIssuer.issuerId)
    const issuerService = issuer.context.dependencyManager.resolve(OpenId4VcIssuerService)
    const { cNonce } = await issuerService.createNonce(issuer.context, openId4VcIssuer)
    const { credentialResponse } = await issuer.openid4vc.issuer.createCredentialResponse({
      issuanceSessionId: result.issuanceSession.id,
      authorization: {
        authorizationServer: 'https://authorization.com',
        accessToken: {
          payload: {
            active: true,
            sub: 'something',
            'pre-authorized_code': 'some',
          },
          value: 'the-access-token',
        },
      },
      credentialRequestToCredentialMapper: ({ issuanceSession }) => {
        expect(issuanceSession.id).toEqual(result.issuanceSession.id)
        expect(issuanceSession.issuanceMetadata).toEqual({
          myIssuance: 'metadata',
        })

        return {
          type: 'credentials',
          format: 'jwt_vc',
          credentialConfigurationId: openBadgeCredential.id,
          credentials: [
            {
              credential: new W3cCredential({
                type: openBadgeCredential.credential_definition.type,
                issuer: new W3cIssuer({ id: issuerDid }),
                credentialSubject: new W3cCredentialSubject({ id: holderDid }),
                issuanceDate: w3cDate(Date.now()),
              }),
              verificationMethod: issuerVerificationMethod.id,
            },
          ],
        }
      },

      credentialRequest: await createCredentialRequest(holder.context, {
        credentialConfiguration: openBadgeCredential,
        issuerMetadata,
        kid: holderKid,
        nonce: cNonce,
      }),
    })

    expect(credentialResponse).toEqual({
      c_nonce: expect.any(String),
      c_nonce_expires_in: 60,
      credential: expect.any(String),
      format: 'jwt_vc_json',
      credentials: undefined,
      notification_id: undefined,
    })

    await handleCredentialResponse(holder.context, credentialResponse.credential, openBadgeCredential)
  })

  it('pre authorized code flow (w3c vc+sd-jwt)', async () => {
    const preAuthorizedCode = '1234567890'

    const result = await issuer.modules.openid4vc.issuer.createCredentialOffer({
      issuerId: openId4VcIssuer.issuerId,
      credentialConfigurationIds: [openBadgeCredentialSdJwtVc.id],
      preAuthorizedCodeFlowConfig: {
        preAuthorizedCode,
      },
      issuanceMetadata: {
        myIssuance: 'metadata',
      },
    })

    const issuanceSessionRepository = issuer.context.dependencyManager.resolve(OpenId4VcIssuanceSessionRepository)
    result.issuanceSession.state = OpenId4VcIssuanceSessionState.AccessTokenCreated
    await issuanceSessionRepository.update(issuer.context, result.issuanceSession)

    expect(result.credentialOffer).toBeDefined()

    const issuerMetadata = await issuer.modules.openid4vc.issuer.getIssuerMetadata(openId4VcIssuer.issuerId)
    const issuerService = issuer.context.dependencyManager.resolve(OpenId4VcIssuerService)
    const { cNonce } = await issuerService.createNonce(issuer.context, openId4VcIssuer)
    const { credentialResponse } = await issuer.modules.openid4vc.issuer.createCredentialResponse({
      issuanceSessionId: result.issuanceSession.id,
      authorization: {
        authorizationServer: 'https://authorization.com',
        accessToken: {
          payload: {
            active: true,
            sub: 'something',
            'pre-authorized_code': 'some',
          },
          value: 'the-access-token',
        },
      },
      credentialRequestToCredentialMapper: ({ issuanceSession }) => {
        expect(issuanceSession.id).toEqual(result.issuanceSession.id)
        expect(issuanceSession.issuanceMetadata).toEqual({
          myIssuance: 'metadata',
        })

        return {
          type: 'credentials',
          format: 'vc+sd-jwt',
          credentialConfigurationId: openBadgeCredentialSdJwtVc.id,
          credentials: [
            {
              alg: 'EdDSA',
              verificationMethod: issuerVerificationMethod.id,
              credential: new W3cV2Credential({
                type: openBadgeCredentialSdJwtVc.credential_definition.type,
                issuer: new W3cV2Issuer({ id: issuerDid }),
                credentialSubject: new W3cV2CredentialSubject({ id: holderDid }),
                validFrom: w3cDate(Date.now()),
              }),
            },
          ],
        }
      },

      credentialRequest: await createCredentialRequest(holder.context, {
        credentialConfiguration: openBadgeCredentialSdJwtVc,
        issuerMetadata,
        kid: holderKid,
        nonce: cNonce,
      }),
    })

    expect(credentialResponse).toEqual({
      c_nonce: expect.any(String),
      c_nonce_expires_in: 60,
      credential: expect.any(String),
      format: 'vc+sd-jwt',
      credentials: undefined,
      notification_id: undefined,
    })

    await handleCredentialResponse(holder.context, credentialResponse.credential, openBadgeCredentialSdJwtVc)
  })

  it('credential id not in credential supported errors', async () => {
    const preAuthorizedCode = '1234567890'

    await expect(
      issuer.openid4vc.issuer.createCredentialOffer({
        issuerId: openId4VcIssuer.issuerId,
        credentialConfigurationIds: ['invalid id'],
        preAuthorizedCodeFlowConfig: {
          preAuthorizedCode,
        },
      })
    ).rejects.toThrow(
      "Credential configuration ids invalid id not found in the credential issuer metadata 'credential_configurations_supported'. Available ids are openBadgeCredential, openBadgeCredentialSdJwtVc, universityDegreeCredential, universityDegreeCredentialLd, universityDegreeCredentialSdJwt."
    )
  })

  it('issuing non offered credential errors', async () => {
    const preAuthorizedCode = '1234567890'

    const result = await issuer.openid4vc.issuer.createCredentialOffer({
      issuerId: openId4VcIssuer.issuerId,
      credentialConfigurationIds: [openBadgeCredential.id],
      preAuthorizedCodeFlowConfig: {
        preAuthorizedCode,
      },
    })

    const issuanceSessionRepository = issuer.context.dependencyManager.resolve(OpenId4VcIssuanceSessionRepository)
    // We need to update the state, as it is checked and we're skipping the access token step
    result.issuanceSession.state = OpenId4VcIssuanceSessionState.AccessTokenCreated
    await issuanceSessionRepository.update(issuer.context, result.issuanceSession)

    const issuerMetadata = await issuer.openid4vc.issuer.getIssuerMetadata(openId4VcIssuer.issuerId)
    const issuerService = issuer.context.dependencyManager.resolve(OpenId4VcIssuerService)
    const { cNonce } = await issuerService.createNonce(issuer.context, openId4VcIssuer)
    await expect(
      issuer.openid4vc.issuer.createCredentialResponse({
        issuanceSessionId: result.issuanceSession.id,
        authorization: {
          authorizationServer: 'https://authorization.com',
          accessToken: {
            payload: {
              active: true,
              sub: 'something',
              'pre-authorized_code': 'some',
            },
            value: 'the-access-token',
          },
        },
        credentialRequest: await createCredentialRequest(holder.context, {
          credentialConfiguration: universityDegreeCredential,
          issuerMetadata,
          kid: holderKid,
          nonce: cNonce,
        }),
        credentialRequestToCredentialMapper: () => {
          throw new Error('Not implemented')
        },
      })
    ).rejects.toThrow('Credential request does not match any credential configurations from credential offer')
  })

  it('pre authorized code flow using multiple credentials_supported', async () => {
    const preAuthorizedCode = '1234567890'

    const result = await issuer.openid4vc.issuer.createCredentialOffer({
      credentialConfigurationIds: [openBadgeCredential.id, universityDegreeCredentialLd.id],
      issuerId: openId4VcIssuer.issuerId,
      preAuthorizedCodeFlowConfig: {
        preAuthorizedCode,
      },
    })

    const issuanceSessionRepository = issuer.context.dependencyManager.resolve(OpenId4VcIssuanceSessionRepository)
    // We need to update the state, as it is checked and we're skipping the access token step
    result.issuanceSession.state = OpenId4VcIssuanceSessionState.AccessTokenCreated
    await issuanceSessionRepository.update(issuer.context, result.issuanceSession)

    const issuerService = issuer.context.dependencyManager.resolve(OpenId4VcIssuerService)
    const { cNonce } = await issuerService.createNonce(issuer.context, openId4VcIssuer)
    const issuerMetadata = await issuer.openid4vc.issuer.getIssuerMetadata(openId4VcIssuer.issuerId)
    const { credentialResponse } = await issuer.openid4vc.issuer.createCredentialResponse({
      issuanceSessionId: result.issuanceSession.id,
      credentialRequest: await createCredentialRequest(holder.context, {
        credentialConfiguration: universityDegreeCredentialLd,
        issuerMetadata,
        kid: holderKid,
        nonce: cNonce,
      }),
      authorization: {
        authorizationServer: 'https://authorization.com',
        accessToken: {
          payload: {
            active: true,
            sub: 'something',
            'pre-authorized_code': 'some',
          },
          value: 'the-access-token',
        },
      },
      credentialRequestToCredentialMapper: () => ({
        type: 'credentials',
        format: 'jwt_vc',
        credentials: [
          {
            credential: new W3cCredential({
              type: universityDegreeCredentialLd.credential_definition.type,
              issuer: new W3cIssuer({ id: issuerDid }),
              credentialSubject: new W3cCredentialSubject({ id: holderDid }),
              issuanceDate: w3cDate(Date.now()),
            }),
            verificationMethod: issuerVerificationMethod.id,
          },
        ],
        credentialConfigurationId: universityDegreeCredentialLd.id,
      }),
    })

    expect(credentialResponse).toEqual({
      c_nonce: expect.any(String),
      c_nonce_expires_in: 60,
      credential: expect.any(String),
      format: 'jwt_vc_json-ld',
      credentials: undefined,
      notification_id: undefined,
    })

    await handleCredentialResponse(holder.context, credentialResponse.credential, universityDegreeCredentialLd)
  })

  it('requesting non offered credential errors', async () => {
    const preAuthorizedCode = '1234567890'

    const result = await issuer.openid4vc.issuer.createCredentialOffer({
      credentialConfigurationIds: [openBadgeCredential.id],
      issuerId: openId4VcIssuer.issuerId,
      preAuthorizedCodeFlowConfig: {
        preAuthorizedCode,
      },
    })

    const issuanceSessionRepository = issuer.context.dependencyManager.resolve(OpenId4VcIssuanceSessionRepository)
    // We need to update the state, as it is checked and we're skipping the access token step
    result.issuanceSession.state = OpenId4VcIssuanceSessionState.AccessTokenCreated
    await issuanceSessionRepository.update(issuer.context, result.issuanceSession)

    const issuerService = issuer.context.dependencyManager.resolve(OpenId4VcIssuerService)
    const { cNonce } = await issuerService.createNonce(issuer.context, openId4VcIssuer)
    const issuerMetadata = await issuer.openid4vc.issuer.getIssuerMetadata(openId4VcIssuer.issuerId)
    await expect(
      issuer.openid4vc.issuer.createCredentialResponse({
        issuanceSessionId: result.issuanceSession.id,
        authorization: {
          authorizationServer: 'https://authorization.com',
          accessToken: {
            payload: {
              active: true,
              sub: 'something',
              'pre-authorized_code': 'some',
            },
            value: 'the-access-token',
          },
        },
        credentialRequest: await createCredentialRequest(holder.context, {
          credentialConfiguration: {
            id: 'someid',
            format: openBadgeCredential.format,
            credential_definition: {
              type: universityDegreeCredential.credential_definition.type,
            },
          },
          issuerMetadata,
          kid: holderKid,
          nonce: cNonce,
        }),
        credentialRequestToCredentialMapper: () => {
          throw new Error('Not implemented')
        },
      })
    ).rejects.toThrow('Credential request does not match any credential configurations from credential offer')
  })

  it('create credential offer and retrieve it from the uri (pre authorized flow)', async () => {
    const preAuthorizedCode = '1234567890'

    const { credentialOffer } = await issuer.openid4vc.issuer.createCredentialOffer({
      issuerId: openId4VcIssuer.issuerId,
      credentialConfigurationIds: [openBadgeCredential.id],
      preAuthorizedCodeFlowConfig: {
        preAuthorizedCode,
      },
    })

    expect(credentialOffer).toMatch(
      new RegExp(
        `^openid-credential-offer://\\?credential_offer_uri=https%3A%2F%2Fopenid4vc-issuer.com%2F${openId4VcIssuer.issuerId}%2Foffers%2F.*$`
      )
    )
  })

  it('offer and request multiple credentials', async () => {
    const preAuthorizedCode = '1234567890'

    const result = await issuer.openid4vc.issuer.createCredentialOffer({
      credentialConfigurationIds: [openBadgeCredential.id, universityDegreeCredential.id],
      issuerId: openId4VcIssuer.issuerId,
      preAuthorizedCodeFlowConfig: {
        preAuthorizedCode,
      },
    })

    const issuanceSessionRepository = issuer.context.dependencyManager.resolve(OpenId4VcIssuanceSessionRepository)
    await issuanceSessionRepository.update(issuer.context, result.issuanceSession)

    const payload = result.issuanceSession.credentialOfferPayload
    expect(payload.credential_configuration_ids).toEqual([openBadgeCredential.id, universityDegreeCredential.id])

    const credentialRequestToCredentialMapper: OpenId4VciCredentialRequestToCredentialMapper = ({
      credentialConfigurationId,
    }) => {
      const credential =
        credentialConfigurationId === openBadgeCredential.id ? openBadgeCredential : universityDegreeCredential
      return {
        type: 'credentials',
        format: 'jwt_vc',
        credentials: [
          {
            credential: new W3cCredential({
              type: credential.credential_definition.type,
              issuer: new W3cIssuer({ id: issuerDid }),
              credentialSubject: new W3cCredentialSubject({ id: holderDid }),
              issuanceDate: w3cDate(Date.now()),
            }),
            verificationMethod: issuerVerificationMethod.id,
          },
        ],
      }
    }

    // We need to update the state, as it is checked and we're skipping the access token step
    result.issuanceSession.state = OpenId4VcIssuanceSessionState.AccessTokenCreated
    await issuanceSessionRepository.update(issuer.context, result.issuanceSession)

    const issuerService = issuer.context.dependencyManager.resolve(OpenId4VcIssuerService)
    const { cNonce } = await issuerService.createNonce(issuer.context, openId4VcIssuer)
    const issuerMetadata = await issuer.openid4vc.issuer.getIssuerMetadata(openId4VcIssuer.issuerId)
    const { credentialResponse } = await issuer.openid4vc.issuer.createCredentialResponse({
      issuanceSessionId: result.issuanceSession.id,
      credentialRequest: await createCredentialRequest(holder.context, {
        credentialConfiguration: openBadgeCredential,
        issuerMetadata,
        kid: holderKid,
        nonce: cNonce,
      }),
      authorization: {
        authorizationServer: 'https://authorization.com',
        accessToken: {
          payload: {
            active: true,
            sub: 'something',
            'pre-authorized_code': 'some',
          },
          value: 'the-access-token',
        },
      },
      credentialRequestToCredentialMapper,
    })

    expect(credentialResponse).toEqual({
      c_nonce: expect.any(String),
      c_nonce_expires_in: 60,
      credential: expect.any(String),
      format: 'jwt_vc_json',
      credentials: undefined,
      notification_id: undefined,
    })

    await handleCredentialResponse(holder.context, credentialResponse.credential, openBadgeCredential)

    const { credentialResponse: credentialResponse2 } = await issuer.openid4vc.issuer.createCredentialResponse({
      issuanceSessionId: result.issuanceSession.id,
      credentialRequest: await createCredentialRequest(holder.context, {
        credentialConfiguration: universityDegreeCredential,
        issuerMetadata,
        kid: holderKid,
        nonce: credentialResponse.c_nonce ?? cNonce,
      }),
      authorization: {
        authorizationServer: 'https://authorization.com',
        accessToken: {
          payload: {
            active: true,
            sub: 'something',
            'pre-authorized_code': 'some',
          },
          value: 'the-access-token',
        },
      },
      credentialRequestToCredentialMapper,
    })

    expect(credentialResponse2).toEqual({
      c_nonce: expect.any(String),
      c_nonce_expires_in: 60,
      credential: expect.any(String),
      format: 'jwt_vc_json',
      credentials: undefined,
      notification_id: undefined,
    })

    await handleCredentialResponse(holder.context, credentialResponse2.credential, universityDegreeCredential)
  })

  it('offer and request multiple credentials (v11 compatibility)', async () => {
    const preAuthorizedCode = '1234567890'

    const result = await issuer.openid4vc.issuer.createCredentialOffer({
      credentialConfigurationIds: [openBadgeCredential.id, universityDegreeCredential.id],
      issuerId: openId4VcIssuer.issuerId,
      preAuthorizedCodeFlowConfig: {
        preAuthorizedCode,
      },
      version: 'v1.draft11-14',
    })

    const issuanceSessionRepository = issuer.context.dependencyManager.resolve(OpenId4VcIssuanceSessionRepository)
    await issuanceSessionRepository.update(issuer.context, result.issuanceSession)

    const payload = result.issuanceSession.credentialOfferPayload
    if ('credentials' in payload === false) {
      throw new Error('Expected credentials in payload. (V11 compatibility)')
    }
    expect(payload.credentials).toEqual([openBadgeCredential.id, universityDegreeCredential.id])

    const credentialRequestToCredentialMapper: OpenId4VciCredentialRequestToCredentialMapper = ({
      credentialConfigurationId,
    }) => {
      const credential =
        credentialConfigurationId === openBadgeCredential.id ? openBadgeCredential : universityDegreeCredential
      return {
        type: 'credentials',
        format: 'jwt_vc',
        credentials: [
          {
            credential: new W3cCredential({
              type: credential.credential_definition.type,
              issuer: new W3cIssuer({ id: issuerDid }),
              credentialSubject: new W3cCredentialSubject({ id: holderDid }),
              issuanceDate: w3cDate(Date.now()),
            }),
            verificationMethod: issuerVerificationMethod.id,
          },
        ],
      }
    }

    // We need to update the state, as it is checked and we're skipping the access token step
    result.issuanceSession.state = OpenId4VcIssuanceSessionState.AccessTokenCreated
    await issuanceSessionRepository.update(issuer.context, result.issuanceSession)

    const issuerService = issuer.context.dependencyManager.resolve(OpenId4VcIssuerService)
    const { cNonce } = await issuerService.createNonce(issuer.context, openId4VcIssuer)
    const issuerMetadata = await issuer.openid4vc.issuer.getIssuerMetadata(openId4VcIssuer.issuerId)
    const { credentialResponse } = await issuer.openid4vc.issuer.createCredentialResponse({
      issuanceSessionId: result.issuanceSession.id,
      credentialRequest: await createCredentialRequest(holder.context, {
        credentialConfiguration: openBadgeCredential,
        issuerMetadata,
        kid: holderKid,
        nonce: cNonce,
      }),
      authorization: {
        authorizationServer: 'https://authorization.com',
        accessToken: {
          payload: {
            active: true,
            sub: 'something',
            'pre-authorized_code': 'some',
          },
          value: 'the-access-token',
        },
      },
      credentialRequestToCredentialMapper,
    })

    expect(credentialResponse).toEqual({
      c_nonce: expect.any(String),
      c_nonce_expires_in: 60,
      credential: expect.any(String),
      format: 'jwt_vc_json',
      credentials: undefined,
      notification_id: undefined,
    })

    await handleCredentialResponse(holder.context, credentialResponse.credential, openBadgeCredential)

    const { credentialResponse: credentialResponse2 } = await issuer.openid4vc.issuer.createCredentialResponse({
      issuanceSessionId: result.issuanceSession.id,
      credentialRequest: await createCredentialRequest(holder.context, {
        credentialConfiguration: universityDegreeCredential,
        issuerMetadata,
        kid: holderKid,
        nonce: credentialResponse.c_nonce ?? cNonce,
      }),
      authorization: {
        authorizationServer: 'https://authorization.com',
        accessToken: {
          payload: {
            active: true,
            sub: 'something',
            'pre-authorized_code': 'some',
          },
          value: 'the-access-token',
        },
      },
      credentialRequestToCredentialMapper,
    })

    expect(credentialResponse2).toEqual({
      c_nonce: expect.any(String),
      c_nonce_expires_in: 60,
      credential: expect.any(String),
      format: 'jwt_vc_json',
      credentials: undefined,
      notification_id: undefined,
    })

    await handleCredentialResponse(holder.context, credentialResponse2.credential, universityDegreeCredential)
  })

  it('custom expiration is correctly applied', async () => {
    const { issuanceSession } = await issuer.openid4vc.issuer.createCredentialOffer({
      credentialConfigurationIds: [openBadgeCredential.id, universityDegreeCredential.id],
      issuerId: openId4VcIssuer.issuerId,
      preAuthorizedCodeFlowConfig: {
        preAuthorizedCode: '1234567890',
      },
      expirationInSeconds: 60 * 60,
    })

    expect(issuanceSession.expiresAt).toEqual(utils.addSecondsToDate(issuanceSession.createdAt, 60 * 60))
  })

  it('deletes an issuance session by id', async () => {
    const { issuanceSession } = await issuer.openid4vc.issuer.createCredentialOffer({
      credentialConfigurationIds: [openBadgeCredential.id],
      issuerId: openId4VcIssuer.issuerId,
      preAuthorizedCodeFlowConfig: {
        preAuthorizedCode: '1234567890',
      },
    })

    await issuer.openid4vc.issuer.deleteIssuanceSessionById(issuanceSession.id)

    await expect(issuer.openid4vc.issuer.getIssuanceSessionById(issuanceSession.id)).rejects.toThrow(
      RecordNotFoundError
    )
  })

  it('throws an error when deleting a non-existent issuance session', async () => {
    await expect(issuer.openid4vc.issuer.deleteIssuanceSessionById('non-existent-id')).rejects.toThrow(
      RecordNotFoundError
    )
  })

  it('configures, keeps in sync and removes the signed metadata signer', async () => {
    const metadataSigner = { method: 'did', didUrl: issuerVerificationMethod.id } as const
    const credentialConfigurationsSupported = { openBadgeCredential }

    // Metadata is not signed by default
    expect(openId4VcIssuer.signedMetadata).toBeUndefined()

    // A signer can be configured on an already existing issuer
    await issuer.openid4vc.issuer.updateIssuerMetadata({
      issuerId: openId4VcIssuer.issuerId,
      credentialConfigurationsSupported,
      display: [{ name: 'Initial issuer' }],
      metadataSigner,
    })

    const enabled = await issuer.openid4vc.issuer.getIssuerByIssuerId(openId4VcIssuer.issuerId)
    expect(enabled.signedMetadata?.signer).toEqual(metadataSigner)
    expect(Jwt.fromSerializedJwt(enabled.signedMetadata?.jwt as string).payload.additionalClaims.display).toMatchObject(
      [{ name: 'Initial issuer' }]
    )

    // Omitting the signer keeps it configured, and the metadata is re-signed so the signed
    // metadata stays in sync with the updated issuer metadata
    await issuer.openid4vc.issuer.updateIssuerMetadata({
      issuerId: openId4VcIssuer.issuerId,
      credentialConfigurationsSupported,
      display: [{ name: 'Updated issuer' }],
    })

    const kept = await issuer.openid4vc.issuer.getIssuerByIssuerId(openId4VcIssuer.issuerId)
    expect(kept.signedMetadata?.signer).toEqual(metadataSigner)
    expect(Jwt.fromSerializedJwt(kept.signedMetadata?.jwt as string).payload.additionalClaims.display).toMatchObject([
      { name: 'Updated issuer' },
    ])

    // Passing null removes the signer, so the metadata is no longer signed
    await issuer.openid4vc.issuer.updateIssuerMetadata({
      issuerId: openId4VcIssuer.issuerId,
      credentialConfigurationsSupported,
      display: [{ name: 'Updated issuer' }],
      metadataSigner: null,
    })

    const removed = await issuer.openid4vc.issuer.getIssuerByIssuerId(openId4VcIssuer.issuerId)
    expect(removed.signedMetadata).toBeUndefined()
    expect(
      (await issuer.openid4vc.issuer.getIssuerMetadata(openId4VcIssuer.issuerId)).signedMetadataJwt
    ).toBeUndefined()
  })

  it('re-signs the metadata with a stored x5c signer', async () => {
    const credentialConfigurationsSupported = { openBadgeCredential }

    const key = await issuer.kms.createKey({ type: { crv: 'P-256', kty: 'EC' } })
    const certificate = await issuer.x509.createCertificate({
      authorityKey: Kms.PublicJwk.fromPublicJwk(key.publicJwk),
      issuer: 'C=NL',
    })
    // The leaf needs a key id so the signing key can be resolved from the KMS.
    certificate.keyId = key.keyId

    await issuer.openid4vc.issuer.updateIssuerMetadata({
      issuerId: openId4VcIssuer.issuerId,
      credentialConfigurationsSupported,
      display: [{ name: 'Initial issuer' }],
      metadataSigner: { method: 'x5c', x5c: [certificate] },
    })

    const enabled = await issuer.openid4vc.issuer.getIssuerByIssuerId(openId4VcIssuer.issuerId)
    expect(enabled.signedMetadata?.signer).toMatchObject({ method: 'x5c', leafCertificateKeyId: key.keyId })

    // Updating without a signer re-signs using the stored one. Unlike a did signer, an x5c signer
    // has to survive a full encode/decode round trip (certificates rebuilt from base64, and the
    // leaf key id restored), so this would fail to sign if that round trip lost the key id.
    await issuer.openid4vc.issuer.updateIssuerMetadata({
      issuerId: openId4VcIssuer.issuerId,
      credentialConfigurationsSupported,
      display: [{ name: 'Updated issuer' }],
    })

    const kept = await issuer.openid4vc.issuer.getIssuerByIssuerId(openId4VcIssuer.issuerId)
    expect(kept.signedMetadata?.signer).toMatchObject({ method: 'x5c', leafCertificateKeyId: key.keyId })

    const jwt = Jwt.fromSerializedJwt(kept.signedMetadata?.jwt as string)
    expect(jwt.header.x5c).toEqual([certificate.toString('base64')])
    expect(jwt.payload.additionalClaims.display).toMatchObject([{ name: 'Updated issuer' }])
  })
})
