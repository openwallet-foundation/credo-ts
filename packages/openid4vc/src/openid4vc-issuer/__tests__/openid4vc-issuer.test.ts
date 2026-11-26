import '@openwallet-foundation/askar-nodejs'
import type {
  AgentContext,
  KeyDidCreateOptions,
  W3cVerifiableCredential,
  W3cVerifyCredentialResult,
} from '@credo-ts/core'
import {
  Agent,
  asArray,
  CredoError,
  DidDocumentBuilder,
  DidKey,
  DidsApi,
  equalsIgnoreOrder,
  getEd25519VerificationKey2018,
  getEd25519VerificationKey2020,
  getMultikey,
  JsonTransformer,
  JwsService,
  Jwt,
  JwtPayload,
  Kms,
  RecordNotFoundError,
  SdJwtVcApi,
  TypedArrayEncoder,
  utils,
  VerificationMethod,
  W3cCredential,
  W3cCredentialService,
  W3cCredentialSubject,
  W3cIssuer,
  W3cJsonLdCredentialSigningNotSupportedError,
  W3cJsonLdVerifiableCredential,
  W3cJwtVerifiableCredential,
  W3cV2Credential,
  W3cV2CredentialService,
  W3cV2CredentialSubject,
  W3cV2Issuer,
  W3cV2SdJwtVerifiableCredential,
  w3cDate,
} from '@credo-ts/core'
import type { Jwk } from '@openid4vc/oauth2'
import { InMemoryWalletModule } from '../../../../../tests/InMemoryWalletModule'
import { transformPrivateKeyToPrivateJwk } from '../../../../askar/src'
import { agentDependencies } from '../../../../node/src'
import { OpenId4VcModule } from '../../OpenId4VcModule'
import type {
  OpenId4VciCredentialConfigurationSupportedWithFormats,
  OpenId4VciCredentialRequest,
  OpenId4VciIssuerInfo,
  OpenId4VciMetadata,
} from '../../shared'
import { OpenId4VciCredentialFormatProfile } from '../../shared'
import { getOid4vcEncryptJweCallback } from '../../shared/callbacks'
import { getAccessTokenJwks } from '../../shared/localJwks'
import { getAccessTokenSigner, getThumbprintKid } from '../../shared/utils'
import { OpenId4VcIssuanceSessionState } from '../OpenId4VcIssuanceSessionState'
import { getCredentialRequestDecryptionMetadata, OpenId4VcIssuerService } from '../OpenId4VcIssuerService'
import type {
  OpenId4VciCredentialRequestEncryptionOptions,
  OpenId4VciCredentialRequestToCredentialMapper,
} from '../OpenId4VcIssuerServiceOptions'
import type { OpenId4VcIssuerRecord } from '../repository'
import { OpenId4VcIssuanceSessionRepository, OpenId4VcIssuerRepository } from '../repository'

/** A `kms.decrypt` call with the key agreement key `keyId` in `backend`. */
const decryptedWith = (keyId: string, backend: string | undefined) =>
  expect.objectContaining({
    backend,
    key: expect.objectContaining({ keyAgreement: expect.objectContaining({ keyId }) }),
  })

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

const verifiableCredentialLdpVc = {
  id: 'verifiableCredentialLdpVc',
  format: OpenId4VciCredentialFormatProfile.LdpVc,
  credential_definition: {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiableCredential'],
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
    key: { keyId: publicJwk.keyId },
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

  const encryptRequest = async (publicJwk: Kms.KmsJwkPublic | Jwk, payload: object, enc = 'A256GCM') => {
    const { jwe } = await getOid4vcEncryptJweCallback(holder.context)(
      { method: 'jwk', publicJwk: publicJwk as Jwk, alg: 'ECDH-ES', enc },
      JSON.stringify(payload)
    )
    return jwe
  }

  const parseCredentialRequestAsWallet = async (credentialRequest: OpenId4VciCredentialRequest) => {
    const issuerService = issuer.context.dependencyManager.resolve(OpenId4VcIssuerService)
    const issuerRecord = await issuer.openid4vc.issuer.getIssuerByIssuerId(openId4VcIssuer.issuerId)
    const issuerMetadata = await issuerService.getIssuerMetadata(issuer.context, issuerRecord)
    const requestEncryption = issuerMetadata.credentialIssuer.credential_request_encryption
    const encrypt =
      requestEncryption && (requestEncryption.encryption_required || credentialRequest.credential_response_encryption)

    return issuerService.getIssuer(issuer.context, { issuer: issuerRecord }).parseCredentialRequest({
      credentialRequest: encrypt
        ? await encryptRequest(requestEncryption.jwks.keys[0], credentialRequest)
        : credentialRequest,
      contentType: encrypt ? 'application/jwt' : 'application/json',
      issuerMetadata,
    })
  }

  it('uses and persists the configured KMS backend for access token signing keys', async () => {
    const createKey = issuer.kms.createKey.bind(issuer.kms)
    const deleteKey = issuer.kms.deleteKey.bind(issuer.kms)
    // The keys are created in the default backend, but reported as created in the requested backend
    const createKeySpy = vi
      .spyOn(issuer.kms, 'createKey')
      .mockImplementation(async ({ backend, backendOptions: _backendOptions, ...options }) => ({
        ...(await createKey(options)),
        backend: backend as string,
      }))
    const deleteKeySpy = vi
      .spyOn(issuer.kms, 'deleteKey')
      .mockImplementation(({ backend: _backend, ...options }) => deleteKey(options))

    const createdIssuer = await issuer.openid4vc.issuer.createIssuer({
      credentialConfigurationsSupported: { openBadgeCredential },
      accessTokenSigner: { createKey: { type: { kty: 'OKP', crv: 'Ed25519' }, backend: 'remote-kms-a' } },
    })

    expect(createKeySpy).toHaveBeenLastCalledWith({
      type: { kty: 'OKP', crv: 'Ed25519' },
      backend: 'remote-kms-a',
    })
    expect(createdIssuer.accessTokenKey?.kmsBackend).toBe('remote-kms-a')

    const previousKeyId = createdIssuer.resolvedAccessTokenPublicJwk.keyId
    await issuer.openid4vc.issuer.rotateAccessTokenSigningKey(createdIssuer.issuerId, {
      accessTokenSigner: { createKey: { type: { kty: 'OKP', crv: 'Ed25519' }, backend: 'remote-kms-b' } },
    })

    expect(createKeySpy).toHaveBeenLastCalledWith({
      type: { kty: 'OKP', crv: 'Ed25519' },
      backend: 'remote-kms-b',
    })
    const rotatedIssuer = await issuer.openid4vc.issuer.getIssuerByIssuerId(createdIssuer.issuerId)
    expect(deleteKeySpy).not.toHaveBeenCalled()
    expect(rotatedIssuer.accessTokenKey).toEqual({
      publicJwk: rotatedIssuer.resolvedAccessTokenPublicJwk.toJson({ includeKid: false }),
      keyId: rotatedIssuer.resolvedAccessTokenPublicJwk.keyId,
      kmsBackend: 'remote-kms-b',
    })
    expect(createdIssuer.accessTokenKey?.publicJwk).not.toHaveProperty('kid')
    expect(rotatedIssuer.previousAccessTokenKeys).toEqual([
      { publicJwk: createdIssuer.accessTokenKey?.publicJwk, keyId: previousKeyId, kmsBackend: 'remote-kms-a' },
    ])

    await issuer.openid4vc.issuer.deletePreviousAccessTokenSigningKeys(createdIssuer.issuerId)
    expect(deleteKeySpy).toHaveBeenLastCalledWith({ keyId: previousKeyId, backend: 'remote-kms-a' })
    expect(
      (await issuer.openid4vc.issuer.getIssuerByIssuerId(createdIssuer.issuerId)).previousAccessTokenKeys
    ).toBeUndefined()
  })

  it('moves the access token key of an issuer from before accessTokenKey to the previous keys when rotating, and verifies its refresh tokens', async () => {
    const issuerRepository = issuer.context.dependencyManager.resolve(OpenId4VcIssuerRepository)
    const issuerService = issuer.context.dependencyManager.resolve(OpenId4VcIssuerService)
    const issuerRecord = await issuer.openid4vc.issuer.createIssuer({
      credentialConfigurationsSupported: { openBadgeCredential },
    })
    const accessTokenKey = issuerRecord.accessTokenKey as NonNullable<typeof issuerRecord.accessTokenKey>
    issuerRecord.accessTokenKey = undefined
    issuerRecord.accessTokenPublicJwk = { ...accessTokenKey.publicJwk, kid: accessTokenKey.keyId }
    issuerRecord.accessTokenSignerKmsBackend = accessTokenKey.kmsBackend
    await issuerRepository.update(issuer.context, issuerRecord)

    // Refresh tokens signed before the upgrade carry the KMS key id as kid
    const key = issuerRecord.resolvedAccessTokenPublicJwk
    const { jwt } = issuerService.parseRefreshToken(
      issuer.context,
      await issuerService.createRefreshToken(issuer.context, issuerRecord, { issuerState: 'state' })
    )
    const legacyRefreshToken = issuerService.parseRefreshToken(
      issuer.context,
      await issuer.context.dependencyManager.resolve(JwsService).createJwsCompact(issuer.context, {
        key,
        payload: jwt.payload,
        protectedHeaderOptions: { typ: 'credo+refresh_token', alg: key.signatureAlgorithm, kid: accessTokenKey.keyId },
      })
    )

    await issuer.openid4vc.issuer.rotateAccessTokenSigningKey(issuerRecord.issuerId)
    const rotatedIssuer = await issuer.openid4vc.issuer.getIssuerByIssuerId(issuerRecord.issuerId)

    await expect(
      issuerService.verifyRefreshToken(issuer.context, rotatedIssuer, legacyRefreshToken)
    ).resolves.toBeUndefined()

    expect(rotatedIssuer.previousAccessTokenKeys).toEqual([accessTokenKey])
    expect(rotatedIssuer.accessTokenKey).toBeDefined()
    expect(rotatedIssuer.accessTokenPublicJwk).toBeUndefined()
    expect(rotatedIssuer.accessTokenSignerKmsBackend).toBeUndefined()
  })

  it('uses an existing KMS key as access token signing key', async () => {
    const signingKey = Kms.PublicJwk.fromKmsKey(await issuer.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } }))
    const createdIssuer = await issuer.openid4vc.issuer.createIssuer({
      credentialConfigurationsSupported: { openBadgeCredential },
      accessTokenSigner: signingKey,
    })
    expect(createdIssuer.accessTokenKey).toEqual({
      publicJwk: signingKey.toJson({ includeKid: false }),
      keyId: signingKey.keyId,
      kmsBackend: signingKey.kmsBackend,
    })
    expect(createdIssuer.resolvedAccessTokenPublicJwk.equals(signingKey)).toBe(true)

    await expect(
      issuer.openid4vc.issuer.rotateAccessTokenSigningKey(createdIssuer.issuerId, {
        accessTokenSigner: { keyId: signingKey.keyId },
      })
    ).rejects.toThrow(`Key with key id '${signingKey.keyId}' is already an access token signing key of the issuer.`)

    const { keyId } = await issuer.kms.createKey({ type: { kty: 'OKP', crv: 'X25519' } })
    await expect(
      issuer.openid4vc.issuer.rotateAccessTokenSigningKey(createdIssuer.issuerId, { accessTokenSigner: { keyId } })
    ).rejects.toThrow(`Key with key id '${keyId}' can't sign access tokens.`)
  })

  it('signs access tokens with the jwk thumbprint as kid and no jwk, and verifies them after the key is rotated', async () => {
    const issuerService = issuer.context.dependencyManager.resolve(OpenId4VcIssuerService)
    const createdIssuer = await issuer.openid4vc.issuer.createIssuer({
      credentialConfigurationsSupported: { openBadgeCredential },
    })
    const issuerMetadata = await issuerService.getIssuerMetadata(issuer.context, createdIssuer)
    const credentialIssuer = issuerMetadata.credentialIssuer.credential_issuer
    const signingKey = createdIssuer.resolvedAccessTokenPublicJwk
    const { access_token } = await issuerService
      .getOauth2AuthorizationServer(issuer.context)
      .createAccessTokenResponse({
        audience: credentialIssuer,
        authorizationServer: credentialIssuer,
        expiresInSeconds: 60,
        signer: getAccessTokenSigner(signingKey),
        subject: 'subject',
      })

    const { header } = Jwt.fromSerializedJwt(access_token)
    expect(header.kid).toEqual(getThumbprintKid(signingKey))
    expect(header.kid).not.toEqual(signingKey.keyId)
    expect(header.jwk).toBeUndefined()

    await issuer.openid4vc.issuer.rotateAccessTokenSigningKey(createdIssuer.issuerId)
    const rotatedIssuer = await issuer.openid4vc.issuer.getIssuerByIssuerId(createdIssuer.issuerId)
    expect(getAccessTokenJwks(rotatedIssuer).keys.map((key) => key.kid)).toEqual([
      getThumbprintKid(rotatedIssuer.resolvedAccessTokenPublicJwk),
      getThumbprintKid(signingKey),
    ])
    const result = await issuerService
      .getResourceServer(issuer.context, rotatedIssuer, issuerMetadata)
      .verifyResourceRequest({
        authorizationServers: issuerMetadata.authorizationServers,
        resourceServer: credentialIssuer,
        request: {
          headers: new Headers({ Authorization: `Bearer ${access_token}` }),
          method: 'POST',
          url: `${credentialIssuer}/credential`,
        },
      })

    expect(result.tokenPayload.sub).toEqual('subject')
  })

  it('verifies tokens signed with the access token key before it was rotated, until the key is deleted', async () => {
    const issuerService = issuer.context.dependencyManager.resolve(OpenId4VcIssuerService)
    const createdIssuer = await issuer.openid4vc.issuer.createIssuer({
      credentialConfigurationsSupported: { openBadgeCredential },
    })
    const refreshToken = issuerService.parseRefreshToken(
      issuer.context,
      await issuerService.createRefreshToken(issuer.context, createdIssuer, { issuerState: 'state' })
    )
    expect(refreshToken.jwt.header.kid).toEqual(getThumbprintKid(createdIssuer.resolvedAccessTokenPublicJwk))

    await issuer.openid4vc.issuer.rotateAccessTokenSigningKey(createdIssuer.issuerId)
    const rotatedIssuer = await issuer.openid4vc.issuer.getIssuerByIssuerId(createdIssuer.issuerId)
    await expect(issuerService.verifyRefreshToken(issuer.context, rotatedIssuer, refreshToken)).resolves.toBeUndefined()

    await issuer.openid4vc.issuer.deletePreviousAccessTokenSigningKeys(createdIssuer.issuerId)
    const issuerWithoutPreviousKeys = await issuer.openid4vc.issuer.getIssuerByIssuerId(createdIssuer.issuerId)
    await expect(
      issuerService.verifyRefreshToken(issuer.context, issuerWithoutPreviousKeys, refreshToken)
    ).rejects.toThrow(`No access token signing key found for kid '${refreshToken.jwt.header.kid}'.`)
    await expect(issuer.kms.getPublicKey({ keyId: createdIssuer.resolvedAccessTokenPublicJwk.keyId })).rejects.toThrow()
  })

  it('deletes only the previous access token signing keys with the given key ids', async () => {
    const createdIssuer = await issuer.openid4vc.issuer.createIssuer({
      credentialConfigurationsSupported: { openBadgeCredential },
    })
    const firstKeyId = createdIssuer.resolvedAccessTokenPublicJwk.keyId
    await issuer.openid4vc.issuer.rotateAccessTokenSigningKey(createdIssuer.issuerId)
    const secondKeyId = (await issuer.openid4vc.issuer.getIssuerByIssuerId(createdIssuer.issuerId))
      .resolvedAccessTokenPublicJwk.keyId
    await issuer.openid4vc.issuer.rotateAccessTokenSigningKey(createdIssuer.issuerId)
    const currentKeyId = (await issuer.openid4vc.issuer.getIssuerByIssuerId(createdIssuer.issuerId))
      .resolvedAccessTokenPublicJwk.keyId

    await expect(
      issuer.openid4vc.issuer.deletePreviousAccessTokenSigningKeys(createdIssuer.issuerId, {
        keyIds: [firstKeyId, currentKeyId],
      })
    ).rejects.toThrow(`No previous access token signing keys found with key ids '${currentKeyId}'.`)

    await issuer.openid4vc.issuer.deletePreviousAccessTokenSigningKeys(createdIssuer.issuerId, { keyIds: [firstKeyId] })
    const updatedIssuer = await issuer.openid4vc.issuer.getIssuerByIssuerId(createdIssuer.issuerId)
    expect(updatedIssuer.resolvedAccessTokenPublicJwks.map((key) => key.keyId)).toEqual([currentKeyId, secondKeyId])
    await expect(issuer.kms.getPublicKey({ keyId: firstKeyId })).rejects.toThrow()
    await expect(issuer.kms.getPublicKey({ keyId: secondKeyId })).resolves.toBeDefined()
  })

  it('signs nonces and client attestation challenges with the jwk thumbprint as kid', async () => {
    const issuerService = issuer.context.dependencyManager.resolve(OpenId4VcIssuerService)
    const createdIssuer = await issuer.openid4vc.issuer.createIssuer({
      credentialConfigurationsSupported: { openBadgeCredential },
    })
    const kid = getThumbprintKid(createdIssuer.resolvedAccessTokenPublicJwk)

    const { cNonce } = await issuerService.createNonce(issuer.context, createdIssuer)
    const { challenge } = await issuerService.createClientAttestationChallenge(issuer.context, createdIssuer)

    expect(Jwt.fromSerializedJwt(cNonce).header.kid).toEqual(kid)
    expect(Jwt.fromSerializedJwt(challenge).header.kid).toEqual(kid)
    await expect(
      issuerService.verifyClientAttestationChallenge(issuer.context, createdIssuer, challenge)
    ).resolves.toBeUndefined()
  })

  it('verifies a refresh token with the KMS key id as kid, and rejects an unknown or missing kid', async () => {
    const issuerService = issuer.context.dependencyManager.resolve(OpenId4VcIssuerService)
    const jwsService = issuer.context.dependencyManager.resolve(JwsService)
    const createdIssuer = await issuer.openid4vc.issuer.createIssuer({
      credentialConfigurationsSupported: { openBadgeCredential },
    })
    const key = createdIssuer.resolvedAccessTokenPublicJwk
    const { jwt } = issuerService.parseRefreshToken(
      issuer.context,
      await issuerService.createRefreshToken(issuer.context, createdIssuer, { issuerState: 'state' })
    )
    const signRefreshToken = async (kid: string | undefined) =>
      issuerService.parseRefreshToken(
        issuer.context,
        await jwsService.createJwsCompact(issuer.context, {
          key,
          payload: jwt.payload,
          protectedHeaderOptions: { typ: 'credo+refresh_token', alg: key.signatureAlgorithm, kid },
        })
      )

    // Refresh tokens signed before the kid became the jwk thumbprint carry the KMS key id
    const legacyRefreshToken = await signRefreshToken(key.keyId)
    await issuer.openid4vc.issuer.rotateAccessTokenSigningKey(createdIssuer.issuerId)
    const rotatedIssuer = await issuer.openid4vc.issuer.getIssuerByIssuerId(createdIssuer.issuerId)
    await expect(
      issuerService.verifyRefreshToken(issuer.context, rotatedIssuer, legacyRefreshToken)
    ).resolves.toBeUndefined()

    await expect(
      issuerService.verifyRefreshToken(issuer.context, rotatedIssuer, await signRefreshToken('unknown'))
    ).rejects.toThrow(`No access token signing key found for kid 'unknown'.`)
    await expect(
      issuerService.verifyRefreshToken(issuer.context, rotatedIssuer, await signRefreshToken(undefined))
    ).rejects.toThrow(`No access token signing key found for kid 'undefined'.`)
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
      await api.verify({ sdJwtVc: credentialInResponse })
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
      parsedCredentialRequest: await parseCredentialRequestAsWallet(credentialRequest),
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

  it('rejects an issuer that is not the issuer of the issuance session', async () => {
    const issuerService = issuer.context.dependencyManager.resolve(OpenId4VcIssuerService)
    const otherIssuer = await issuer.openid4vc.issuer.createIssuer({
      credentialConfigurationsSupported: { universityDegreeCredentialSdJwt },
    })

    const { issuanceSession } = await issuer.openid4vc.issuer.createCredentialOffer({
      issuerId: openId4VcIssuer.issuerId,
      credentialConfigurationIds: [universityDegreeCredentialSdJwt.id],
      preAuthorizedCodeFlowConfig: { preAuthorizedCode: '1234567890' },
    })
    issuanceSession.state = OpenId4VcIssuanceSessionState.CredentialRequestReceived
    issuanceSession.transactions = [
      { transactionId: 'tx', numberOfCredentials: 1, credentialConfigurationId: universityDegreeCredentialSdJwt.id },
    ]

    const { cNonce } = await issuerService.createNonce(issuer.context, openId4VcIssuer)
    const credentialRequest = await createCredentialRequest(holder.context, {
      credentialConfiguration: universityDegreeCredentialSdJwt,
      issuerMetadata: await issuer.openid4vc.issuer.getIssuerMetadata(openId4VcIssuer.issuerId),
      kid: holderKid,
      nonce: cNonce,
    })
    const authorization = {
      authorizationServer: 'https://authorization.com',
      accessToken: { payload: { active: true, sub: 'something' }, value: 'the-access-token' },
    }
    const error = `Issuer '${otherIssuer.issuerId}' is not the issuer '${openId4VcIssuer.issuerId}' of issuance session '${issuanceSession.id}'.`

    await expect(
      issuerService.createCredentialResponse(issuer.context, {
        issuanceSession,
        issuer: otherIssuer,
        parsedCredentialRequest: await parseCredentialRequestAsWallet(credentialRequest),
        authorization,
      })
    ).rejects.toThrow(error)

    await expect(
      issuerService.createDeferredCredentialResponse(issuer.context, {
        issuanceSession,
        issuer: otherIssuer,
        deferredCredentialRequest: { transaction_id: 'tx' },
        authorization,
      })
    ).rejects.toThrow(error)
  })

  it.each([
    [['did:key'], undefined],
    [['did'], undefined],
    [['jwk', 'did:web'], "Binding method 'did:key' is not supported"],
    [['cose_key'], "Binding method 'did:key' is not supported"],
  ])('binding methods %j with a did:key proof', async (bindingMethods, expectedError) => {
    const credentialConfiguration = {
      ...universityDegreeCredentialSdJwt,
      cryptographic_binding_methods_supported: bindingMethods,
      proof_types_supported: { jwt: { proof_signing_alg_values_supported: ['EdDSA'] } },
    } satisfies OpenId4VciCredentialConfigurationSupportedWithFormats
    await issuer.openid4vc.issuer.updateIssuerMetadata({
      issuerId: openId4VcIssuer.issuerId,
      credentialConfigurationsSupported: { [credentialConfiguration.id]: credentialConfiguration },
    })

    const { issuanceSession } = await issuer.openid4vc.issuer.createCredentialOffer({
      issuerId: openId4VcIssuer.issuerId,
      credentialConfigurationIds: [credentialConfiguration.id],
      preAuthorizedCodeFlowConfig: { preAuthorizedCode: '1234567890' },
    })
    issuanceSession.state = OpenId4VcIssuanceSessionState.AccessTokenCreated
    await issuer.context.dependencyManager
      .resolve(OpenId4VcIssuanceSessionRepository)
      .update(issuer.context, issuanceSession)

    const { cNonce } = await issuer.context.dependencyManager
      .resolve(OpenId4VcIssuerService)
      .createNonce(issuer.context, openId4VcIssuer)
    const credentialRequest = await createCredentialRequest(holder.context, {
      credentialConfiguration,
      issuerMetadata: await issuer.openid4vc.issuer.getIssuerMetadata(openId4VcIssuer.issuerId),
      kid: holderKid,
      nonce: cNonce,
    })

    const credentialResponsePromise = issuer.openid4vc.issuer.createCredentialResponse({
      issuanceSessionId: issuanceSession.id,
      parsedCredentialRequest: await parseCredentialRequestAsWallet(credentialRequest),
      authorization: {
        authorizationServer: 'https://authorization.com',
        accessToken: {
          payload: { active: true, sub: 'something', 'pre-authorized_code': 'some' },
          value: 'the-access-token',
        },
      },
      credentialRequestToCredentialMapper: () => ({
        type: 'credentials',
        format: 'dc+sd-jwt',
        credentials: [
          {
            payload: { vct: 'UniversityDegreeCredential', degree: 'bachelor' },
            issuer: { method: 'did', didUrl: issuerVerificationMethod.id },
            holder: { method: 'did', didUrl: holderVerificationMethod.id },
          },
        ],
        credentialConfigurationId: credentialConfiguration.id,
      }),
    })

    if (expectedError) {
      await expect(credentialResponsePromise).rejects.toMatchObject({
        errorResponse: { error: 'invalid_proof', error_description: expect.stringContaining(expectedError) },
      })
    } else {
      await expect(credentialResponsePromise).resolves.toMatchObject({
        credentialResponse: { credential: expect.any(String) },
      })
    }
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
      parsedCredentialRequest: await parseCredentialRequestAsWallet(credentialRequest),
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

  it('returns a v1 batch response for a session without a version and a credential_configuration_id request', async () => {
    const preAuthorizedCode = '1234567890'
    const result = await issuer.openid4vc.issuer.createCredentialOffer({
      issuerId: openId4VcIssuer.issuerId,
      credentialConfigurationIds: [universityDegreeCredentialSdJwt.id],
      preAuthorizedCodeFlowConfig: { preAuthorizedCode },
    })

    // Sessions stored before the version was persisted have no version
    const issuanceSessionRepository = issuer.context.dependencyManager.resolve(OpenId4VcIssuanceSessionRepository)
    result.issuanceSession.openId4VciVersion = undefined
    result.issuanceSession.state = OpenId4VcIssuanceSessionState.AccessTokenCreated
    await issuanceSessionRepository.update(issuer.context, result.issuanceSession)

    const issuerService = issuer.context.dependencyManager.resolve(OpenId4VcIssuerService)
    const { cNonce } = await issuerService.createNonce(issuer.context, openId4VcIssuer)
    const issuerMetadata = await issuer.openid4vc.issuer.getIssuerMetadata(openId4VcIssuer.issuerId)
    const { proof } = (await createCredentialRequest(holder.context, {
      credentialConfiguration: universityDegreeCredentialSdJwt,
      issuerMetadata,
      kid: holderKid,
      nonce: cNonce,
    })) as { proof: { jwt: string } }

    const { credentialResponse } = await issuer.openid4vc.issuer.createCredentialResponse({
      issuanceSessionId: result.issuanceSession.id,
      parsedCredentialRequest: await parseCredentialRequestAsWallet({
        credential_configuration_id: universityDegreeCredentialSdJwt.id,
        proofs: { jwt: [proof.jwt] },
      }),
      authorization: {
        authorizationServer: 'https://authorization.com',
        accessToken: {
          payload: { active: true, sub: 'something', 'pre-authorized_code': preAuthorizedCode },
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

    expect(credentialResponse.credentials).toEqual([{ credential: expect.any(String) }])
  })

  it('verifies the c_nonce once for a batch of proofs', async () => {
    const preAuthorizedCode = '1234567890'
    const result = await issuer.openid4vc.issuer.createCredentialOffer({
      issuerId: openId4VcIssuer.issuerId,
      credentialConfigurationIds: [universityDegreeCredentialSdJwt.id],
      preAuthorizedCodeFlowConfig: { preAuthorizedCode },
    })

    const issuanceSessionRepository = issuer.context.dependencyManager.resolve(OpenId4VcIssuanceSessionRepository)
    result.issuanceSession.state = OpenId4VcIssuanceSessionState.AccessTokenCreated
    await issuanceSessionRepository.update(issuer.context, result.issuanceSession)

    const issuerService = issuer.context.dependencyManager.resolve(OpenId4VcIssuerService)
    const { cNonce } = await issuerService.createNonce(issuer.context, openId4VcIssuer)
    const issuerMetadata = await issuer.openid4vc.issuer.getIssuerMetadata(openId4VcIssuer.issuerId)
    const { proof } = (await createCredentialRequest(holder.context, {
      credentialConfiguration: universityDegreeCredentialSdJwt,
      issuerMetadata,
      kid: holderKid,
      nonce: cNonce,
    })) as { proof: { jwt: string } }

    const verifyNonce = vi.spyOn(issuerService as unknown as { verifyNonce: () => Promise<void> }, 'verifyNonce')
    const { credentialResponse } = await issuer.openid4vc.issuer.createCredentialResponse({
      issuanceSessionId: result.issuanceSession.id,
      parsedCredentialRequest: await parseCredentialRequestAsWallet({
        credential_configuration_id: universityDegreeCredentialSdJwt.id,
        proofs: { jwt: [proof.jwt, proof.jwt, proof.jwt] },
      }),
      authorization: {
        authorizationServer: 'https://authorization.com',
        accessToken: {
          payload: { active: true, sub: 'something', 'pre-authorized_code': preAuthorizedCode },
          value: 'the-access-token',
        },
      },
      credentialRequestToCredentialMapper: ({ holderBinding }) => ({
        type: 'credentials',
        format: 'dc+sd-jwt',
        credentials: holderBinding.keys.map(() => ({
          payload: { vct: 'UniversityDegreeCredential', university: 'innsbruck', degree: 'bachelor' },
          issuer: { method: 'did', didUrl: issuerVerificationMethod.id },
          holder: { method: 'did', didUrl: holderVerificationMethod.id },
          disclosureFrame: { _sd: ['university', 'degree'] },
        })),
        credentialConfigurationId: universityDegreeCredentialSdJwt.id,
      }),
    })

    expect(credentialResponse.credentials).toHaveLength(3)
    expect(verifyNonce).toHaveBeenCalledTimes(1)
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

      parsedCredentialRequest: await parseCredentialRequestAsWallet(
        await createCredentialRequest(holder.context, {
          credentialConfiguration: openBadgeCredential,
          issuerMetadata,
          kid: holderKid,
          nonce: cNonce,
        })
      ),
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

  describe('credential of another type or format than the requested credential configuration', () => {
    const createCredentialResponse = async (
      credentialConfiguration: OpenId4VciCredentialConfigurationSupportedWithFormats & { id: string },
      credentialRequestToCredentialMapper: OpenId4VciCredentialRequestToCredentialMapper
    ) => {
      const result = await issuer.openid4vc.issuer.createCredentialOffer({
        issuerId: openId4VcIssuer.issuerId,
        credentialConfigurationIds: [credentialConfiguration.id],
        preAuthorizedCodeFlowConfig: { preAuthorizedCode: '1234567890' },
      })

      const issuanceSessionRepository = issuer.context.dependencyManager.resolve(OpenId4VcIssuanceSessionRepository)
      result.issuanceSession.state = OpenId4VcIssuanceSessionState.AccessTokenCreated
      await issuanceSessionRepository.update(issuer.context, result.issuanceSession)

      const issuerMetadata = await issuer.openid4vc.issuer.getIssuerMetadata(openId4VcIssuer.issuerId)
      const issuerService = issuer.context.dependencyManager.resolve(OpenId4VcIssuerService)
      const { cNonce } = await issuerService.createNonce(issuer.context, openId4VcIssuer)

      return issuer.openid4vc.issuer.createCredentialResponse({
        issuanceSessionId: result.issuanceSession.id,
        authorization: {
          authorizationServer: 'https://authorization.com',
          accessToken: {
            payload: { active: true, sub: 'something', 'pre-authorized_code': 'some' },
            value: 'the-access-token',
          },
        },
        credentialRequestToCredentialMapper,
        parsedCredentialRequest: await parseCredentialRequestAsWallet(
          await createCredentialRequest(holder.context, {
            credentialConfiguration,
            issuerMetadata,
            kid: holderKid,
            nonce: cNonce,
          })
        ),
      })
    }

    it('rejects a jwt_vc_json credential of another type than the requested credential configuration', async () => {
      await expect(
        createCredentialResponse(openBadgeCredential, () => ({
          type: 'credentials',
          format: 'jwt_vc',
          credentialConfigurationId: openBadgeCredential.id,
          credentials: [
            {
              credential: new W3cCredential({
                type: universityDegreeCredential.credential_definition.type,
                issuer: new W3cIssuer({ id: issuerDid }),
                credentialSubject: new W3cCredentialSubject({ id: holderDid }),
                issuanceDate: w3cDate(Date.now()),
              }),
              verificationMethod: issuerVerificationMethod.id,
            },
          ],
        }))
      ).rejects.toThrow(
        "Expected the credential type to include each type of the credential configuration, 'VerifiableCredential', 'OpenBadgeCredential', received 'VerifiableCredential', 'UniversityDegreeCredential'."
      )
    })

    it('rejects a W3C vc+sd-jwt credential of another type than the requested credential configuration', async () => {
      await expect(
        createCredentialResponse(openBadgeCredentialSdJwtVc, () => ({
          type: 'credentials',
          format: 'vc+sd-jwt',
          credentialConfigurationId: openBadgeCredentialSdJwtVc.id,
          credentials: [
            {
              alg: 'EdDSA',
              verificationMethod: issuerVerificationMethod.id,
              credential: new W3cV2Credential({
                type: universityDegreeCredential.credential_definition.type,
                issuer: new W3cV2Issuer({ id: issuerDid }),
                credentialSubject: new W3cV2CredentialSubject({ id: holderDid }),
                validFrom: w3cDate(Date.now()),
              }),
            },
          ],
        }))
      ).rejects.toThrow(
        "Expected the credential type to include each type of the credential configuration, 'VerifiableCredential', 'OpenBadgeCredentialSdJwtVc', received 'VerifiableCredential', 'UniversityDegreeCredential'."
      )
    })

    it('rejects a W3C vc+sd-jwt credential for a requested SD-JWT VC credential configuration', async () => {
      await expect(
        createCredentialResponse(universityDegreeCredentialSdJwt, () => ({
          type: 'credentials',
          format: 'vc+sd-jwt',
          credentialConfigurationId: universityDegreeCredentialSdJwt.id,
          credentials: [
            {
              alg: 'EdDSA',
              verificationMethod: issuerVerificationMethod.id,
              credential: new W3cV2Credential({
                type: universityDegreeCredential.credential_definition.type,
                issuer: new W3cV2Issuer({ id: issuerDid }),
                credentialSubject: new W3cV2CredentialSubject({ id: holderDid }),
                validFrom: w3cDate(Date.now()),
              }),
            },
          ],
        }))
      ).rejects.toThrow(
        "Invalid credential format returned by sign options. Expected 'dc+sd-jwt', received 'vc+sd-jwt'."
      )
    })
  })

  describe('pre authorized code flow (ldp_vc)', () => {
    type Purpose = 'authentication' | 'assertionMethod'

    // A did:web document can hold any verification method type and resolves from the local did record.
    // The issuer and holder agents share storage, so the holder resolves it too.
    const importLdpIssuerDid = async (
      name: string,
      getVerificationMethod: (options: {
        id: string
        controller: string
        publicJwk: Kms.PublicJwk<Kms.Ed25519PublicJwk>
      }) => VerificationMethod,
      purposes: Purpose[]
    ) => {
      const did = `did:web:${name}.example.com`
      const kid = `${did}#key-1`
      const key = await issuer.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })
      const builder = new DidDocumentBuilder(did)
        .addContext('https://w3id.org/security/suites/ed25519-2018/v1')
        .addContext('https://w3id.org/security/suites/ed25519-2020/v1')
        .addVerificationMethod(
          getVerificationMethod({
            id: kid,
            controller: did,
            publicJwk: Kms.PublicJwk.fromPublicJwk(key.publicJwk) as Kms.PublicJwk<Kms.Ed25519PublicJwk>,
          })
        )
      if (purposes.includes('authentication')) builder.addAuthentication(kid)
      if (purposes.includes('assertionMethod')) builder.addAssertionMethod(kid)
      await issuer.dids.import({
        did,
        didDocument: builder.build(),
        keys: [{ didDocumentRelativeKeyId: '#key-1', kmsKeyId: key.keyId }],
      })

      return { did, kid }
    }

    const createLdpVcCredentialResponse = async (issuerDid: string, issuerKid: string) => {
      openId4VcIssuer = await issuer.openid4vc.issuer.createIssuer({
        credentialConfigurationsSupported: { verifiableCredentialLdpVc },
      })

      const result = await issuer.openid4vc.issuer.createCredentialOffer({
        issuerId: openId4VcIssuer.issuerId,
        credentialConfigurationIds: [verifiableCredentialLdpVc.id],
        preAuthorizedCodeFlowConfig: { preAuthorizedCode: '1234567890' },
      })

      const issuanceSessionRepository = issuer.context.dependencyManager.resolve(OpenId4VcIssuanceSessionRepository)
      result.issuanceSession.state = OpenId4VcIssuanceSessionState.AccessTokenCreated
      await issuanceSessionRepository.update(issuer.context, result.issuanceSession)

      const issuerMetadata = await issuer.openid4vc.issuer.getIssuerMetadata(openId4VcIssuer.issuerId)
      const issuerService = issuer.context.dependencyManager.resolve(OpenId4VcIssuerService)
      const { cNonce } = await issuerService.createNonce(issuer.context, openId4VcIssuer)
      const parsedCredentialRequest = await parseCredentialRequestAsWallet(
        await createCredentialRequest(holder.context, {
          credentialConfiguration: verifiableCredentialLdpVc,
          issuerMetadata,
          kid: holderKid,
          nonce: cNonce,
        })
      )

      return issuer.openid4vc.issuer.createCredentialResponse({
        issuanceSessionId: result.issuanceSession.id,
        authorization: {
          authorizationServer: 'https://authorization.com',
          accessToken: {
            payload: { active: true, sub: 'something', 'pre-authorized_code': 'some' },
            value: 'the-access-token',
          },
        },
        credentialRequestToCredentialMapper: () => ({
          type: 'credentials',
          format: 'ldp_vc',
          credentialConfigurationId: verifiableCredentialLdpVc.id,
          credentials: [
            {
              credential: new W3cCredential({
                context: verifiableCredentialLdpVc.credential_definition['@context'],
                type: verifiableCredentialLdpVc.credential_definition.type,
                issuer: new W3cIssuer({ id: issuerDid }),
                credentialSubject: new W3cCredentialSubject({ id: holderDid }),
                issuanceDate: w3cDate(Date.now()),
              }),
              verificationMethod: issuerKid,
            },
          ],
        }),
        parsedCredentialRequest,
      })
    }

    it.each([
      [
        'Ed25519VerificationKey2018',
        ['authentication', 'assertionMethod'],
        getEd25519VerificationKey2018,
        'Ed25519Signature2018',
      ],
      [
        'Ed25519VerificationKey2020',
        ['authentication', 'assertionMethod'],
        getEd25519VerificationKey2020,
        'Ed25519Signature2020',
      ],
      // Signing only needs assertionMethod, so suite selection must not require authentication
      ['Ed25519VerificationKey2020', ['assertionMethod'], getEd25519VerificationKey2020, 'Ed25519Signature2020'],
    ] as const)(
      'issues with an %s issuer method under %j',
      async (verificationMethodType, purposes, getVerificationMethod, proofType) => {
        const { did, kid } = await importLdpIssuerDid(
          `${verificationMethodType.toLowerCase()}-${purposes.join('-').toLowerCase()}`,
          getVerificationMethod,
          [...purposes]
        )

        const { credentialResponse } = await createLdpVcCredentialResponse(did, kid)

        const credential = await handleCredentialResponse(
          holder.context,
          credentialResponse.credential as Record<string, unknown>,
          verifiableCredentialLdpVc
        )
        expect(credential).toBeInstanceOf(W3cJsonLdVerifiableCredential)
        expect(asArray((credential as W3cJsonLdVerifiableCredential).proof)).toEqual([
          expect.objectContaining({ type: proofType, verificationMethod: kid }),
        ])
      }
    )

    it('rejects an issuer did the agent did not create with a typed error', async () => {
      const didKey = new DidKey(Kms.PublicJwk.fromFingerprint('z6MkvBpZTRb7tjuUF5AkmhG1JDV928hZbg5KAQJcogvhz9ax'))

      await expect(
        createLdpVcCredentialResponse(didKey.did, `${didKey.did}#${didKey.publicJwk.fingerprint}`)
      ).rejects.toMatchObject({
        constructor: W3cJsonLdCredentialSigningNotSupportedError,
        reason: 'verification-method-not-controlled',
      })
    })

    it('rejects an issuer method that is only listed under authentication with a typed error', async () => {
      const { did, kid } = await importLdpIssuerDid('authentication-only', getEd25519VerificationKey2020, [
        'authentication',
      ])

      await expect(createLdpVcCredentialResponse(did, kid)).rejects.toMatchObject({
        constructor: W3cJsonLdCredentialSigningNotSupportedError,
        reason: 'verification-method-not-found',
      })
    })

    it('rejects an issuer method type no suite supports with a typed error', async () => {
      const { did, kid } = await importLdpIssuerDid(
        'multikey',
        ({ id, controller, publicJwk }) =>
          new VerificationMethod(getMultikey({ did: controller, verificationMethodId: id, publicJwk })),
        ['assertionMethod']
      )

      await expect(createLdpVcCredentialResponse(did, kid)).rejects.toMatchObject({
        constructor: W3cJsonLdCredentialSigningNotSupportedError,
        reason: 'unsupported-verification-method-type',
        message: "No signature suite supports the verification method type 'Multikey'",
      })
    })
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

      parsedCredentialRequest: await parseCredentialRequestAsWallet(
        await createCredentialRequest(holder.context, {
          credentialConfiguration: openBadgeCredentialSdJwtVc,
          issuerMetadata,
          kid: holderKid,
          nonce: cNonce,
        })
      ),
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
        parsedCredentialRequest: await parseCredentialRequestAsWallet(
          await createCredentialRequest(holder.context, {
            credentialConfiguration: universityDegreeCredential,
            issuerMetadata,
            kid: holderKid,
            nonce: cNonce,
          })
        ),
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
      parsedCredentialRequest: await parseCredentialRequestAsWallet(
        await createCredentialRequest(holder.context, {
          credentialConfiguration: universityDegreeCredentialLd,
          issuerMetadata,
          kid: holderKid,
          nonce: cNonce,
        })
      ),
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
        parsedCredentialRequest: await parseCredentialRequestAsWallet(
          await createCredentialRequest(holder.context, {
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
          })
        ),
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
      parsedCredentialRequest: await parseCredentialRequestAsWallet(
        await createCredentialRequest(holder.context, {
          credentialConfiguration: openBadgeCredential,
          issuerMetadata,
          kid: holderKid,
          nonce: cNonce,
        })
      ),
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
      parsedCredentialRequest: await parseCredentialRequestAsWallet(
        await createCredentialRequest(holder.context, {
          credentialConfiguration: universityDegreeCredential,
          issuerMetadata,
          kid: holderKid,
          nonce: credentialResponse.c_nonce ?? cNonce,
        })
      ),
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
      parsedCredentialRequest: await parseCredentialRequestAsWallet(
        await createCredentialRequest(holder.context, {
          credentialConfiguration: openBadgeCredential,
          issuerMetadata,
          kid: holderKid,
          nonce: cNonce,
        })
      ),
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
      parsedCredentialRequest: await parseCredentialRequestAsWallet(
        await createCredentialRequest(holder.context, {
          credentialConfiguration: universityDegreeCredential,
          issuerMetadata,
          kid: holderKid,
          nonce: credentialResponse.c_nonce ?? cNonce,
        })
      ),
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

  it('creates, updates and removes issuer info in stored and signed metadata', async () => {
    const issuerInfo: OpenId4VciIssuerInfo = [
      { format: 'registration_cert', data: 'registration.certificate.jwt' },
      { format: 'custom', data: { issuer: 'Example Issuer' } },
    ]
    const created = await issuer.openid4vc.issuer.createIssuer({
      credentialConfigurationsSupported: { openBadgeCredential },
      issuerInfo,
      metadataSigner: { method: 'did', didUrl: issuerVerificationMethod.id },
    })

    const stored = await issuer.openid4vc.issuer.getIssuerByIssuerId(created.issuerId)
    expect(stored.issuerInfo).toEqual(issuerInfo)
    expect((await issuer.openid4vc.issuer.getIssuerMetadata(created.issuerId)).credentialIssuer.issuer_info).toEqual(
      issuerInfo
    )
    expect(Jwt.fromSerializedJwt(stored.signedMetadata?.jwt as string).payload.additionalClaims.issuer_info).toEqual(
      issuerInfo
    )

    const updatedInfo: OpenId4VciIssuerInfo = [{ format: 'registration_cert', data: 'updated.certificate.jwt' }]
    await issuer.openid4vc.issuer.updateIssuerMetadata({
      issuerId: created.issuerId,
      credentialConfigurationsSupported: { openBadgeCredential },
      issuerInfo: updatedInfo,
    })

    const updated = await issuer.openid4vc.issuer.getIssuerByIssuerId(created.issuerId)
    expect(updated.issuerInfo).toEqual(updatedInfo)
    expect((await issuer.openid4vc.issuer.getIssuerMetadata(created.issuerId)).credentialIssuer.issuer_info).toEqual(
      updatedInfo
    )
    expect(Jwt.fromSerializedJwt(updated.signedMetadata?.jwt as string).payload.additionalClaims.issuer_info).toEqual(
      updatedInfo
    )

    await issuer.openid4vc.issuer.updateIssuerMetadata({
      issuerId: created.issuerId,
      credentialConfigurationsSupported: { openBadgeCredential },
    })

    const removed = await issuer.openid4vc.issuer.getIssuerByIssuerId(created.issuerId)
    expect(removed.issuerInfo).toBeUndefined()
    expect(
      (await issuer.openid4vc.issuer.getIssuerMetadata(created.issuerId)).credentialIssuer.issuer_info
    ).toBeUndefined()
    expect(Jwt.fromSerializedJwt(removed.signedMetadata?.jwt as string).payload.additionalClaims).not.toHaveProperty(
      'issuer_info'
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

  it('rejects a jwk metadata signer', async () => {
    const key = await issuer.kms.createKey({ type: { crv: 'P-256', kty: 'EC' } })

    await expect(
      issuer.openid4vc.issuer.createIssuer({
        credentialConfigurationsSupported: { openBadgeCredential },
        // @ts-expect-error a jwk signer is not allowed
        metadataSigner: { method: 'jwk', jwk: Kms.PublicJwk.fromPublicJwk(key.publicJwk) },
      })
    ).rejects.toThrow(`Signing the credential issuer metadata with a 'jwk' signer is not supported.`)

    // Issuer records stored before jwk signers were rejected can still hold one
    openId4VcIssuer.signedMetadata = { signer: { method: 'jwk', jwk: key.publicJwk }, jwt: 'signed.metadata.jwt' }
    await issuer.context.dependencyManager.resolve(OpenId4VcIssuerRepository).update(issuer.context, openId4VcIssuer)

    await expect(
      issuer.openid4vc.issuer.updateIssuerMetadata({
        issuerId: openId4VcIssuer.issuerId,
        credentialConfigurationsSupported: { openBadgeCredential },
      })
    ).rejects.toThrow(`Signing the credential issuer metadata with a 'jwk' signer is not supported.`)
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

  it('encrypts the credential response when the wallet requests credential_response_encryption', async () => {
    const preAuthorizedCode = '1234567890'
    const requestEncryptionKey = await issuer.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
    await issuer.openid4vc.issuer.updateIssuerMetadata({
      issuerId: openId4VcIssuer.issuerId,
      credentialConfigurationsSupported: openId4VcIssuer.credentialConfigurationsSupported,
      credentialRequestEncryption: { keys: [Kms.PublicJwk.fromKmsKey(requestEncryptionKey)] },
    })

    const result = await issuer.openid4vc.issuer.createCredentialOffer({
      issuerId: openId4VcIssuer.issuerId,
      credentialConfigurationIds: [universityDegreeCredentialSdJwt.id],
      preAuthorizedCodeFlowConfig: { preAuthorizedCode },
    })

    const issuanceSessionRepository = issuer.context.dependencyManager.resolve(OpenId4VcIssuanceSessionRepository)
    const issuerService = issuer.context.dependencyManager.resolve(OpenId4VcIssuerService)
    result.issuanceSession.state = OpenId4VcIssuanceSessionState.AccessTokenCreated
    await issuanceSessionRepository.update(issuer.context, result.issuanceSession)

    const encKey = await holder.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
    const encPublicJwk = {
      ...Kms.PublicJwk.fromPublicJwk(encKey.publicJwk).toJson(),
      alg: 'ECDH-ES',
      kid: encKey.keyId,
    }

    const { cNonce } = await issuerService.createNonce(issuer.context, openId4VcIssuer)
    const issuerMetadata = await issuer.openid4vc.issuer.getIssuerMetadata(openId4VcIssuer.issuerId)
    const baseRequest = await createCredentialRequest(holder.context, {
      credentialConfiguration: universityDegreeCredentialSdJwt,
      issuerMetadata,
      kid: holderKid,
      nonce: cNonce,
    })

    const credentialRequest = {
      ...baseRequest,
      credential_response_encryption: { jwk: encPublicJwk, enc: 'A128GCM' },
    }

    const { credentialResponse, credentialResponseJwt } = await issuer.openid4vc.issuer.createCredentialResponse({
      issuanceSessionId: result.issuanceSession.id,
      parsedCredentialRequest: await parseCredentialRequestAsWallet(credentialRequest),
      authorization: {
        authorizationServer: 'https://authorization.com',
        accessToken: {
          payload: { active: true, sub: 'something', 'pre-authorized_code': preAuthorizedCode },
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

    expect(credentialResponseJwt).toBeDefined()
    expect(credentialResponseJwt?.split('.').length).toBe(5)
    expect(credentialResponse.credential).toBeDefined()
  })

  describe('credential response encryption configuration', () => {
    const requestSdJwtCredential = async (enc?: string) => {
      const preAuthorizedCode = '1234567890'
      const result = await issuer.openid4vc.issuer.createCredentialOffer({
        issuerId: openId4VcIssuer.issuerId,
        credentialConfigurationIds: [universityDegreeCredentialSdJwt.id],
        preAuthorizedCodeFlowConfig: { preAuthorizedCode },
      })

      const issuanceSessionRepository = issuer.context.dependencyManager.resolve(OpenId4VcIssuanceSessionRepository)
      const issuerService = issuer.context.dependencyManager.resolve(OpenId4VcIssuerService)
      result.issuanceSession.state = OpenId4VcIssuanceSessionState.AccessTokenCreated
      await issuanceSessionRepository.update(issuer.context, result.issuanceSession)

      const encKey = await holder.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
      const jwk = { ...Kms.PublicJwk.fromPublicJwk(encKey.publicJwk).toJson(), alg: 'ECDH-ES', kid: encKey.keyId }

      const { cNonce } = await issuerService.createNonce(issuer.context, openId4VcIssuer)
      const issuerMetadata = await issuer.openid4vc.issuer.getIssuerMetadata(openId4VcIssuer.issuerId)
      const baseRequest = await createCredentialRequest(holder.context, {
        credentialConfiguration: universityDegreeCredentialSdJwt,
        issuerMetadata,
        kid: holderKid,
        nonce: cNonce,
      })

      return issuer.openid4vc.issuer.createCredentialResponse({
        issuanceSessionId: result.issuanceSession.id,
        parsedCredentialRequest: await parseCredentialRequestAsWallet(
          enc ? { ...baseRequest, credential_response_encryption: { jwk, enc } } : baseRequest
        ),
        authorization: {
          authorizationServer: 'https://authorization.com',
          accessToken: {
            payload: { active: true, sub: 'something', 'pre-authorized_code': preAuthorizedCode },
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
    }

    const configureEncryption = async (
      credentialResponseEncryption?: OpenId4VcIssuerRecord['credentialResponseEncryption']
    ) => {
      const requestEncryptionKey = await issuer.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
      await issuer.openid4vc.issuer.updateIssuerMetadata({
        issuerId: openId4VcIssuer.issuerId,
        credentialConfigurationsSupported: openId4VcIssuer.credentialConfigurationsSupported,
        credentialRequestEncryption: { keys: [Kms.PublicJwk.fromKmsKey(requestEncryptionKey)] },
        credentialResponseEncryption,
      })
    }

    it('does not advertise response encryption without request encryption', async () => {
      const issuerMetadata = await issuer.openid4vc.issuer.getIssuerMetadata(openId4VcIssuer.issuerId)
      expect(issuerMetadata.credentialIssuer.credential_response_encryption).toBeUndefined()

      await expect(requestSdJwtCredential('A256GCM')).rejects.toMatchObject({
        errorResponse: { error: 'invalid_encryption_parameters' },
      })
    })

    it('rejects response encryption configured without request encryption', async () => {
      await expect(
        issuer.openid4vc.issuer.updateIssuerMetadata({
          issuerId: openId4VcIssuer.issuerId,
          credentialConfigurationsSupported: openId4VcIssuer.credentialConfigurationsSupported,
          credentialResponseEncryption: { required: true },
        })
      ).rejects.toThrow("'credentialResponseEncryption' requires 'credentialRequestEncryption'")
    })

    it('advertises all supported algorithms and optional encryption when request encryption is configured', async () => {
      await configureEncryption()
      const issuerMetadata = await issuer.openid4vc.issuer.getIssuerMetadata(openId4VcIssuer.issuerId)

      expect(issuerMetadata.credentialIssuer.credential_response_encryption).toEqual({
        alg_values_supported: ['ECDH-ES'],
        enc_values_supported: ['A128GCM', 'A256GCM', 'A128CBC-HS256'],
        encryption_required: false,
      })
    })

    it('advertises the configured algorithms and encryption_required', async () => {
      await configureEncryption({ required: true, encValuesSupported: ['A256GCM'] })
      const issuerMetadata = await issuer.openid4vc.issuer.getIssuerMetadata(openId4VcIssuer.issuerId)

      expect(issuerMetadata.credentialIssuer.credential_response_encryption).toEqual({
        alg_values_supported: ['ECDH-ES'],
        enc_values_supported: ['A256GCM'],
        encryption_required: true,
      })
    })

    it('rejects an unencrypted credential request when encryption is required', async () => {
      await configureEncryption({ required: true })

      await expect(requestSdJwtCredential()).rejects.toMatchObject({
        errorResponse: { error: 'invalid_encryption_parameters' },
      })
    })

    it('rejects a credential request with an enc value that is not supported by the issuer', async () => {
      await configureEncryption({ encValuesSupported: ['A256GCM'] })

      await expect(requestSdJwtCredential('A128GCM')).rejects.toMatchObject({
        errorResponse: {
          error: 'invalid_encryption_parameters',
          error_description: "Credential response encryption 'enc' must be one of 'A256GCM'",
        },
      })
    })

    it('encrypts the credential response when encryption is required and requested', async () => {
      await configureEncryption({ required: true })

      const { credentialResponseJwt } = await requestSdJwtCredential('A256GCM')
      expect(credentialResponseJwt?.split('.').length).toBe(5)
    })
  })

  describe('credential request encryption', () => {
    const configureRequestEncryption = async (
      credentialRequestEncryption?: Partial<OpenId4VciCredentialRequestEncryptionOptions>
    ) => {
      const key = await issuer.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
      await issuer.openid4vc.issuer.updateIssuerMetadata({
        issuerId: openId4VcIssuer.issuerId,
        credentialConfigurationsSupported: openId4VcIssuer.credentialConfigurationsSupported,
        credentialRequestEncryption: {
          keys: [Kms.PublicJwk.fromKmsKey(key)],
          ...credentialRequestEncryption,
        },
      })
      return {
        key,
        publicJwk: key.publicJwk,
        issuerRecord: await issuer.openid4vc.issuer.getIssuerByIssuerId(openId4VcIssuer.issuerId),
      }
    }

    // The jwk as the metadata publishes it, with the jwk thumbprint as kid
    const advertisedJwk = ({ kid: _, ...publicJwk }: Kms.KmsJwkPublic) => ({
      ...publicJwk,
      kid: getThumbprintKid(publicJwk),
      use: 'enc',
      alg: 'ECDH-ES',
    })

    const parse = async (issuerRecord: OpenId4VcIssuerRecord, credentialRequest: unknown) => {
      const issuerService = issuer.context.dependencyManager.resolve(OpenId4VcIssuerService)
      return issuerService.getIssuer(issuer.context, { issuer: issuerRecord }).parseCredentialRequest({
        credentialRequest,
        contentType: typeof credentialRequest === 'string' ? 'application/jwt' : 'application/json',
        issuerMetadata: getCredentialRequestDecryptionMetadata(
          await issuerService.getIssuerMetadata(issuer.context, issuerRecord),
          issuerRecord
        ),
      })
    }

    const credentialRequest = {
      credential_configuration_id: 'universityDegreeCredential',
      proofs: { jwt: ['ey.ey.ey'] },
    }

    it('does not advertise credential_request_encryption by default', async () => {
      const issuerMetadata = await issuer.openid4vc.issuer.getIssuerMetadata(openId4VcIssuer.issuerId)
      expect(issuerMetadata.credentialIssuer.credential_request_encryption).toBeUndefined()
    })

    it('advertises the configured encryption keys with the jwk thumbprint as kid', async () => {
      const { key, publicJwk } = await configureRequestEncryption({ required: true })
      const issuerMetadata = await issuer.openid4vc.issuer.getIssuerMetadata(openId4VcIssuer.issuerId)

      expect(issuerMetadata.credentialIssuer.credential_request_encryption).toEqual({
        jwks: { keys: [advertisedJwk(publicJwk)] },
        enc_values_supported: ['A128GCM', 'A256GCM', 'A128CBC-HS256'],
        encryption_required: true,
      })
      expect(JSON.stringify(issuerMetadata)).not.toContain(key.keyId)
    })

    it('decrypts a credential request encrypted to the advertised kid with the KMS key and backend', async () => {
      const { key, publicJwk, issuerRecord } = await configureRequestEncryption()
      const decrypt = vi.spyOn(issuer.kms, 'decrypt')

      await expect(
        parse(issuerRecord, await encryptRequest(advertisedJwk(publicJwk), credentialRequest))
      ).resolves.toMatchObject({ credentialRequest })
      expect(decrypt).toHaveBeenCalledWith(decryptedWith(key.keyId, key.backend))
    })

    it('accepts an unencrypted credential request when encryption is not required', async () => {
      const { issuerRecord } = await configureRequestEncryption()

      await expect(parse(issuerRecord, credentialRequest)).resolves.toMatchObject({ credentialRequest })
    })

    it('rejects an unencrypted credential request when encryption is required', async () => {
      const { issuerRecord } = await configureRequestEncryption({ required: true })

      await expect(parse(issuerRecord, credentialRequest)).rejects.toMatchObject({
        errorResponse: { error: 'invalid_encryption_parameters' },
      })
    })

    it('rejects an unencrypted credential request that asks for response encryption', async () => {
      const { issuerRecord } = await configureRequestEncryption()
      const holderKey = await holder.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })

      await expect(
        parse(issuerRecord, {
          ...credentialRequest,
          credential_response_encryption: { jwk: holderKey.publicJwk, enc: 'A256GCM' },
        })
      ).rejects.toMatchObject({ errorResponse: { error: 'invalid_encryption_parameters' } })
    })

    it('rejects a credential request encrypted to a key that is not advertised', async () => {
      const { issuerRecord } = await configureRequestEncryption()
      const otherKey = await issuer.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })

      await expect(
        parse(issuerRecord, await encryptRequest(otherKey.publicJwk, credentialRequest))
      ).rejects.toMatchObject({ errorResponse: { error: 'invalid_encryption_parameters' } })
    })

    it('decrypts a credential request encrypted to any of the advertised keys', async () => {
      const firstKey = await issuer.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
      const secondKey = await issuer.kms.createKey({ type: { kty: 'EC', crv: 'P-384' } })
      await issuer.openid4vc.issuer.updateIssuerMetadata({
        issuerId: openId4VcIssuer.issuerId,
        credentialConfigurationsSupported: openId4VcIssuer.credentialConfigurationsSupported,
        credentialRequestEncryption: {
          keys: [Kms.PublicJwk.fromKmsKey(firstKey), Kms.PublicJwk.fromKmsKey(secondKey)],
        },
      })
      const issuerRecord = await issuer.openid4vc.issuer.getIssuerByIssuerId(openId4VcIssuer.issuerId)

      await expect(
        parse(issuerRecord, await encryptRequest(advertisedJwk(secondKey.publicJwk), credentialRequest))
      ).resolves.toMatchObject({ credentialRequest })
    })

    it('decrypts a credential request encrypted to a previous key without advertising it', async () => {
      const previousKey = await issuer.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
      const { publicJwk, issuerRecord } = await configureRequestEncryption({
        previousKeys: [Kms.PublicJwk.fromKmsKey(previousKey)],
      })

      const issuerMetadata = await issuer.openid4vc.issuer.getIssuerMetadata(openId4VcIssuer.issuerId)
      expect(issuerMetadata.credentialIssuer.credential_request_encryption?.jwks.keys).toEqual([
        advertisedJwk(publicJwk),
      ])

      await expect(
        parse(issuerRecord, await encryptRequest(advertisedJwk(previousKey.publicJwk), credentialRequest))
      ).resolves.toMatchObject({ credentialRequest })
    })

    it('stores the keys with their KMS key id and backend, and no kid', async () => {
      const { key, issuerRecord } = await configureRequestEncryption()
      const { kid: _, ...publicJwk } = key.publicJwk

      expect(issuerRecord.credentialRequestEncryption?.keys).toEqual([
        { publicJwk, keyId: key.keyId, kmsBackend: key.backend },
      ])
    })

    it('rejects a key without a KMS key id', async () => {
      const { kid: _, ...publicJwk } = (await issuer.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })).publicJwk

      await expect(
        issuer.openid4vc.issuer.updateIssuerMetadata({
          issuerId: openId4VcIssuer.issuerId,
          credentialConfigurationsSupported: openId4VcIssuer.credentialConfigurationsSupported,
          credentialRequestEncryption: { keys: [Kms.PublicJwk.fromPublicJwk(publicJwk)] },
        })
      ).rejects.toThrow(
        `Credential request encryption key '${getThumbprintKid(publicJwk)}' has no KMS key id. Create it with 'PublicJwk.fromKmsKey'.`
      )
    })

    it('rejects a key id that is in both keys and previousKeys', async () => {
      const key = await issuer.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })

      await expect(
        issuer.openid4vc.issuer.updateIssuerMetadata({
          issuerId: openId4VcIssuer.issuerId,
          credentialConfigurationsSupported: openId4VcIssuer.credentialConfigurationsSupported,
          credentialRequestEncryption: {
            keys: [Kms.PublicJwk.fromKmsKey(key)],
            previousKeys: [Kms.PublicJwk.fromKmsKey(key)],
          },
        })
      ).rejects.toThrow(
        `Credential request encryption key '${key.keyId}' must be unique across 'keys' and 'previousKeys'.`
      )
    })

    it('rejects a credential request encryption key that does not support ECDH-ES', async () => {
      const key = await issuer.kms.createKey({ type: { kty: 'OKP', crv: 'Ed25519' } })

      await expect(
        issuer.openid4vc.issuer.updateIssuerMetadata({
          issuerId: openId4VcIssuer.issuerId,
          credentialConfigurationsSupported: openId4VcIssuer.credentialConfigurationsSupported,
          credentialRequestEncryption: { keys: [Kms.PublicJwk.fromKmsKey(key)] },
        })
      ).rejects.toThrow(`Credential request encryption key '${key.keyId}' does not support 'ECDH-ES' key agreement.`)
    })

    it('does not advertise response encryption for a stored issuer without request encryption', async () => {
      const issuerRepository = issuer.context.dependencyManager.resolve(OpenId4VcIssuerRepository)
      const issuerRecord = await issuer.openid4vc.issuer.getIssuerByIssuerId(openId4VcIssuer.issuerId)
      issuerRecord.credentialResponseEncryption = { required: true }
      await issuerRepository.update(issuer.context, issuerRecord)

      const warn = vi.spyOn(issuer.context.config.logger, 'warn')

      const issuerMetadata = await issuer.openid4vc.issuer.getIssuerMetadata(openId4VcIssuer.issuerId)
      expect(issuerMetadata.credentialIssuer.credential_response_encryption).toBeUndefined()
      expect(issuerMetadata.credentialIssuer.credential_request_encryption).toBeUndefined()
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("without 'credentialRequestEncryption'"))

      await expect(issuer.openid4vc.issuer.updateIssuer(issuerRecord)).rejects.toThrow(
        "'credentialResponseEncryption' requires 'credentialRequestEncryption'"
      )
    })

    it('rejects a key without a KMS backend', async () => {
      const key = await issuer.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
      const publicJwk = Kms.PublicJwk.fromKmsKey(key)
      publicJwk.kmsBackend = undefined

      await expect(
        issuer.openid4vc.issuer.updateIssuerMetadata({
          issuerId: openId4VcIssuer.issuerId,
          credentialConfigurationsSupported: openId4VcIssuer.credentialConfigurationsSupported,
          credentialRequestEncryption: { keys: [publicJwk] },
        })
      ).rejects.toThrow(
        `Credential request encryption key '${key.keyId}' has no KMS backend. Create it with 'PublicJwk.fromKmsKey'.`
      )
    })

    it('rejects an issuer with response encryption but without request encryption', async () => {
      await expect(
        issuer.openid4vc.issuer.createIssuer({
          credentialConfigurationsSupported: openId4VcIssuer.credentialConfigurationsSupported,
          credentialResponseEncryption: { required: true },
        })
      ).rejects.toThrow("'credentialResponseEncryption' requires 'credentialRequestEncryption'")
    })
  })
})
