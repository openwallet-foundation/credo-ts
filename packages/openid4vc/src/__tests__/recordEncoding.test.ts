import path from 'node:path'
import { JsonTransformer, Kms, TypedArrayEncoder } from '@credo-ts/core'
import { testRecordEncoding } from '../../../core/tests/recordEncoding'
import { OpenId4VcIssuanceSessionState } from '../openid4vc-issuer/OpenId4VcIssuanceSessionState'
import { OpenId4VcIssuanceSessionRecord } from '../openid4vc-issuer/repository/OpenId4VcIssuanceSessionRecord'
import { OpenId4VcIssuerRecord } from '../openid4vc-issuer/repository/OpenId4VcIssuerRecord'
import { OpenId4VcVerificationSessionState } from '../openid4vc-verifier/OpenId4VcVerificationSessionState'
import { OpenId4VcVerificationSessionRecord } from '../openid4vc-verifier/repository/OpenId4VcVerificationSessionRecord'
import { OpenId4VcVerifierRecord } from '../openid4vc-verifier/repository/OpenId4VcVerifierRecord'
import type { OpenId4VpAuthorizationRequestPayload } from '../shared'

const createdAt = new Date('2026-01-01T00:00:00.000Z')
const updatedAt = new Date('2026-01-02T00:00:00.000Z')
const expiresAt = new Date('2026-01-03T00:00:00.000Z')

const holderJwk = {
  kty: 'EC',
  crv: 'P-256',
  x: '969Qi28BrTJYhiiuY62UwNwd-FlBDUv6aw-WjqrISmY',
  y: 'X1loO6-u-U3PAjA4FCN9ut8SyPU5mT8nbGyuiFL-SOg',
} as const

const attestedJwk = {
  kty: 'EC',
  crv: 'P-256',
  x: 'tWziK1jXpAf9hu7fcytC8CY-ewM-7SsycSXggfss2-0',
  y: 't-urZOcA8zNUcxidySW01ieQ0mUysLdDMnZrbJGNaY4',
  kid: 'attested-key-id',
} as const

const ed25519Jwk = {
  kty: 'OKP',
  crv: 'Ed25519',
  x: 'a2MV1EhywNkwJAStsNWmpa7IRKjaCpu7niIKJQ3xTRI',
} as const

const x5cCertificate =
  'MIIBEzCBu6ADAgECAhBwnaR5jboQ4R7Ne/k+sfhCMAoGCCqGSM49BAMCMA0xCzAJBgNVBAYTAk5MMB4XDTcwMDEwMTAwMDAwMFoXDTI1MTEyMjA4MjIxMlowDTELMAkGA1UEBhMCTkwwOTATBgcqhkjOPQIBBggqhkjOPQMBBwMiAALcD1XzKepFxWMAOqV+ln1fybBt7DRO5CV0f9A6mRp2xaMdMBswGQYDVR0RBBIwEIIOZnVua2UuYW5pbW8uaWQwCgYIKoZIzj0EAwIDRwAwRAIgPM5ITfUD6VWLgRm8Eu1gw53Of+SUdjS+yRClR68m//4CIDxnng7NnJyGnpsKDuUqSIl/A0rRQCwTLBZw9Hx3MZnZ'

const base64UrlJson = (value: unknown) =>
  TypedArrayEncoder.toBase64Url(TypedArrayEncoder.fromUtf8String(JSON.stringify(value)))

const dcqlAuthorizationRequestPayload = {
  response_type: 'vp_token',
  client_id: 'x509_san_dns:verifier.example.com',
  response_uri: 'https://verifier.example.com/oid4vp/verifier-id/authorize',
  response_mode: 'direct_post.jwt',
  nonce: 'request-nonce',
  state: 'request-state',
  aud: 'https://self-issued.me/v2',
  iat: 1767225600,
  exp: 1767229200,
  dcql_query: {
    credentials: [
      {
        id: 'pid',
        format: 'dc+sd-jwt',
        meta: { vct_values: ['urn:eudi:pid:1'] },
        claims: [{ path: ['given_name'] }, { path: ['family_name'] }, { path: ['address', 'country'] }],
      },
      {
        id: 'mdl',
        format: 'mso_mdoc',
        meta: { doctype_value: 'org.iso.18013.5.1.mDL' },
        claims: [{ path: ['org.iso.18013.5.1', 'driving_privileges'], intent_to_retain: false }],
      },
    ],
    credential_sets: [{ options: [['pid'], ['mdl']], required: true }],
  },
  client_metadata: {
    client_name: 'Example Verifier',
    logo_uri: 'https://verifier.example.com/logo.png',
    jwks: { keys: [{ ...attestedJwk, use: 'enc', alg: 'ECDH-ES' }] },
    encrypted_response_enc_values_supported: ['A128GCM', 'A256GCM'],
    vp_formats_supported: {
      'dc+sd-jwt': { 'sd-jwt_alg_values': ['ES256'], 'kb-jwt_alg_values': ['ES256'] },
      mso_mdoc: { issuerauth_alg_values: [-7], deviceauth_alg_values: [-7] },
    },
  },
  transaction_data: [base64UrlJson({ type: 'payment', credential_ids: ['pid'], amount: '10.00' })],
} satisfies OpenId4VpAuthorizationRequestPayload

const dcqlAuthorizationRequestJwt = [
  base64UrlJson({ alg: 'ES256', typ: 'oauth-authz-req+jwt', x5c: [x5cCertificate] }),
  base64UrlJson(dcqlAuthorizationRequestPayload),
  'c2lnbmF0dXJl',
].join('.')

testRecordEncoding(path.join(__dirname, '__fixtures__/records'), {
  OpenId4VcIssuanceSessionRecord: () => {
    const record = new OpenId4VcIssuanceSessionRecord({
      id: 'issuance-session-id',
      createdAt,
      expiresAt,
      tags: { custom: 'tag' },
      state: OpenId4VcIssuanceSessionState.CredentialsPartiallyIssued,
      issuerId: 'issuer-id',
      clientId: 'wallet-client-id',
      walletAttestation: {
        required: true,
        confirmationJwkThumbprint: 'wallet-attestation-jkt',
      },
      dpop: {
        required: true,
        dpopJkt: 'dpop-jkt',
      },
      preAuthorizedCode: 'pre-authorized-code',
      userPin: '493536',
      pkce: {
        required: true,
        codeChallengeMethod: 'S256' as never,
        codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      },
      authorization: {
        code: 'authorization-code',
        codeExpiresAt: new Date('2026-01-01T00:10:00.000Z'),
        issuerState: 'issuer-state',
        scopes: ['openid', 'pid'],
        subject: 'authorization-subject',
      },
      presentation: {
        required: true,
        authSession: 'presentation-auth-session',
        openId4VcVerificationSessionId: 'verification-session-id',
      },
      chainedIdentity: {
        externalAuthorizationServerUrl: 'https://idp.example.com',
        requestUriReferenceValue: 'request-uri-reference-value',
        requestUriExpiresAt: new Date('2026-01-01T00:20:00.000Z'),
        state: 'wallet-state',
        redirectUri: 'https://wallet.example.com/redirect',
        pkceCodeVerifier: 'pkce-code-verifier',
        externalAuthorizationRequestUrl: 'https://idp.example.com/authorize?client_id=issuer&state=external-state',
        externalState: 'external-state',
        externalAuthorizationServerMetadata: {
          issuer: 'https://idp.example.com',
          token_endpoint: 'https://idp.example.com/token',
          authorization_endpoint: 'https://idp.example.com/authorize',
          pushed_authorization_request_endpoint: 'https://idp.example.com/par',
          jwks_uri: 'https://idp.example.com/jwks',
          code_challenge_methods_supported: ['S256'],
          dpop_signing_alg_values_supported: ['ES256'],
          require_pushed_authorization_requests: true,
        },
        externalAccessTokenResponse: {
          access_token: 'external-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'openid profile',
          refresh_token: 'external-refresh-token',
          id_token: 'eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.c2lnbmF0dXJl',
        },
      },
      transactions: [
        {
          transactionId: 'transaction-jwk',
          numberOfCredentials: 2,
          credentialConfigurationId: 'pid-sd-jwt',
          deferredUntil: new Date('2026-01-01T01:00:00.000Z'),
          holderBinding: {
            proofType: 'attestation',
            bindingMethod: 'jwk',
            keyAttestation: {
              header: { alg: 'ES256', typ: 'key-attestation+jwt', x5c: [x5cCertificate] },
              payload: {
                iat: 1767225600,
                exp: 1767229200,
                nonce: 'c-nonce',
                key_storage: ['iso_18045_high'],
                user_authentication: ['iso_18045_moderate'],
                attested_keys: [holderJwk, attestedJwk],
              },
              signer: {
                method: 'x5c',
                alg: 'ES256',
                x5c: [x5cCertificate],
                publicJwk: attestedJwk,
              },
              // biome-ignore lint/suspicious/noExplicitAny: verified key attestation shape is not exported
            } as any,
            keys: [
              { method: 'jwk', jwk: Kms.PublicJwk.fromUnknown(holderJwk) },
              { method: 'jwk', jwk: Kms.PublicJwk.fromUnknown(attestedJwk) },
            ],
          },
        },
        {
          transactionId: 'transaction-did',
          numberOfCredentials: 1,
          credentialConfigurationId: 'diploma-jwt-vc',
          deferredUntil: new Date('2026-01-01T02:00:00.000Z'),
          holderBinding: {
            proofType: 'jwt',
            bindingMethod: 'did',
            keys: [
              {
                method: 'did',
                didUrl:
                  'did:key:z6MkqgkLrRyLg6bqk27djwbbaQWgaSYgFVCKq9YKxZbNkpVv#z6MkqgkLrRyLg6bqk27djwbbaQWgaSYgFVCKq9YKxZbNkpVv',
                jwk: Kms.PublicJwk.fromUnknown(ed25519Jwk),
              },
            ],
          },
        },
      ],
      credentialOfferUri: 'https://issuer.example.com/oid4vci/issuer-id/offers/credential-offer-id',
      credentialOfferId: 'credential-offer-id',
      credentialOfferPayload: {
        credential_issuer: 'https://issuer.example.com/oid4vci/issuer-id',
        credential_configuration_ids: ['pid-sd-jwt', 'diploma-jwt-vc'],
        grants: {
          'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
            'pre-authorized_code': 'pre-authorized-code',
            tx_code: { input_mode: 'numeric', length: 6, description: 'Enter the code sent by email' },
            authorization_server: 'https://issuer.example.com/oid4vci/issuer-id',
          },
          authorization_code: {
            issuer_state: 'issuer-state',
            authorization_server: 'https://issuer.example.com/oid4vci/issuer-id',
          },
        },
      },
      issuanceMetadata: { userId: 'user-id', claims: { given_name: 'Erika', age: 42, verified: true } },
      errorMessage: 'Partial issuance error',
      generateRefreshTokens: true,
      openId4VciVersion: 'v1',
    })
    record.updatedAt = updatedAt
    record.issuedCredentials = ['issued-credential-1', 'issued-credential-2']
    record.metadata.set('meta', { key: 'value' })
    return record
  },

  OpenId4VcIssuerRecord: () => {
    const record = new OpenId4VcIssuerRecord({
      id: 'issuer-record-id',
      createdAt,
      tags: { custom: 'tag' },
      issuerId: 'issuer-id',
      accessTokenPublicJwk: { ...holderJwk, kid: 'access-token-key-id' },
      accessTokenSignerKmsBackend: 'remote-kms',
      dpopSigningAlgValuesSupported: ['ES256', 'EdDSA'],
      clientAttestationSigningAlgValuesSupported: ['ES256'],
      clientAttestationPopSigningAlgValuesSupported: ['ES256', 'ES384'],
      display: [
        {
          name: 'Example Issuer',
          locale: 'en-US',
          logo: { uri: 'https://issuer.example.com/logo.png', alt_text: 'Example Issuer logo' },
        },
        { name: 'Voorbeeld Uitgever', locale: 'nl-NL' },
      ],
      issuerInfo: [
        { format: 'registration_cert', data: 'eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJpc3N1ZXIifQ.c2lnbmF0dXJl' },
        { format: 'custom', data: { registered: true }, credential_ids: ['pid-sd-jwt'] },
      ],
      authorizationServerConfigs: [
        {
          type: 'direct',
          issuer: 'https://auth.example.com',
          clientAuthentication: { type: 'clientSecret', clientId: 'issuer-server', clientSecret: 'issuer-secret' },
        },
        {
          type: 'chained',
          issuer: 'https://idp.example.com',
          clientAuthentication: { type: 'clientSecret', clientId: 'chained-client', clientSecret: 'chained-secret' },
          scopesMapping: { pid: ['openid', 'profile'], diploma: [] },
          redirectUris: ['https://wallet.example.com/redirect'],
        },
      ],
      credentialConfigurationsSupported: {
        'pid-sd-jwt': {
          format: 'dc+sd-jwt',
          vct: 'urn:eudi:pid:1',
          scope: 'pid',
          cryptographic_binding_methods_supported: ['jwk'],
          credential_signing_alg_values_supported: ['ES256'],
          proof_types_supported: {
            jwt: {
              proof_signing_alg_values_supported: ['ES256'],
              key_attestations_required: { key_storage: ['iso_18045_high'] },
            },
            attestation: { proof_signing_alg_values_supported: ['ES256'] },
          },
          credential_metadata: {
            display: [
              {
                name: 'PID',
                locale: 'en-US',
                background_color: '#12107c',
                text_color: '#ffffff',
                logo: { uri: 'https://issuer.example.com/pid.png', alt_text: 'PID logo' },
              },
            ],
            claims: [
              { path: ['given_name'], mandatory: true, display: [{ name: 'Given name', locale: 'en-US' }] },
              { path: ['address', 'country'] },
            ],
          },
        },
        'diploma-jwt-vc': {
          format: 'jwt_vc_json',
          scope: 'diploma',
          cryptographic_binding_methods_supported: ['did:key'],
          credential_signing_alg_values_supported: ['EdDSA'],
          credential_definition: { type: ['VerifiableCredential', 'UniversityDegreeCredential'] },
        },
        'mdl-mdoc': {
          format: 'mso_mdoc',
          doctype: 'org.iso.18013.5.1.mDL',
          cryptographic_binding_methods_supported: ['cose_key'],
          credential_signing_alg_values_supported: [-7],
        },
      },
      batchCredentialIssuance: { batchSize: 10 },
      credentialResponseEncryption: {
        required: true,
        algValuesSupported: ['ECDH-ES'],
        encValuesSupported: ['A128GCM', 'A256GCM'],
      },
      signedMetadata: {
        signer: { method: 'x5c', x5c: [x5cCertificate], leafCertificateKeyId: 'leaf-key-id' },
        jwt: 'eyJhbGciOiJFUzI1NiIsInR5cCI6Im9wZW5pZHZjaS1pc3N1ZXItbWV0YWRhdGErand0In0.eyJzdWIiOiJpc3N1ZXIifQ.c2lnbmF0dXJl',
      },
    })
    record.updatedAt = updatedAt
    record.metadata.set('meta', { key: 'value' })
    return record
  },

  // Records created before key ids were introduced store the fingerprint of the access token key
  'OpenId4VcIssuerRecord.accessTokenPublicKeyFingerprint': () => {
    const record = new OpenId4VcIssuerRecord({
      id: 'legacy-issuer-record-id',
      createdAt,
      issuerId: 'legacy-issuer-id',
      accessTokenPublicJwk: { ...ed25519Jwk, kid: 'unused' },
      credentialConfigurationsSupported: {
        'diploma-jwt-vc': {
          format: 'jwt_vc_json',
          credential_definition: { type: ['VerifiableCredential', 'UniversityDegreeCredential'] },
        },
      },
    })
    record.accessTokenPublicJwk = undefined
    record.accessTokenPublicKeyFingerprint = 'z6MkqgkLrRyLg6bqk27djwbbaQWgaSYgFVCKq9YKxZbNkpVv'
    return record
  },

  OpenId4VcVerificationSessionRecord: () => {
    const record = new OpenId4VcVerificationSessionRecord({
      id: 'verification-session-id',
      createdAt,
      expiresAt,
      tags: { custom: 'tag' },
      verifierId: 'verifier-id',
      state: OpenId4VcVerificationSessionState.Error,
      errorMessage: 'Presentation verification failed',
      authorizationRequestJwt: dcqlAuthorizationRequestJwt,
      authorizationRequestPayload: dcqlAuthorizationRequestPayload,
      authorizationRequestUri:
        'openid4vp://?client_id=x509_san_dns%3Averifier.example.com&request_uri=https%3A%2F%2Fverifier.example.com%2Foid4vp%2Fverifier-id%2Fauthorization-requests%2Fauthorization-request-id',
      authorizationRequestId: 'authorization-request-id',
      authorizationResponseRedirectUri: 'https://verifier.example.com/done',
      authorizationResponsePayload: {
        vp_token: {
          pid: ['eyJhbGciOiJFUzI1NiIsInR5cCI6ImRjK3NkLWp3dCJ9.eyJ2Y3QiOiJ1cm46ZXVkaTpwaWQ6MSJ9.c2lnbmF0dXJl~'],
          mdl: ['o2d2ZXJzaW9uYzEuMGlkb2N1bWVudHOBomdkb2NUeXBldW9yZy5pc28uMTgwMTMuNS4xLm1ETA'],
        },
        state: 'request-state',
      },
      presentationDuringIssuanceSession: 'presentation-during-issuance-session',
      openId4VpVersion: 'v1',
    })
    record.updatedAt = updatedAt
    record.metadata.set('meta', { key: 'value' })
    return record
  },

  'OpenId4VcVerificationSessionRecord.presentationExchange': () => {
    const record = new OpenId4VcVerificationSessionRecord({
      id: 'pex-verification-session-id',
      createdAt,
      expiresAt,
      verifierId: 'verifier-id',
      state: OpenId4VcVerificationSessionState.ResponseVerified,
      authorizationRequestPayload: {
        response_type: 'vp_token',
        client_id: 'redirect_uri:https://verifier.example.com/oid4vp/verifier-id/authorize',
        response_uri: 'https://verifier.example.com/oid4vp/verifier-id/authorize',
        response_mode: 'direct_post',
        nonce: 'pex-nonce',
        state: 'pex-state',
        presentation_definition: {
          id: 'presentation-definition-id',
          input_descriptors: [
            {
              id: 'university-degree',
              format: { jwt_vc_json: { alg: ['EdDSA'] } },
              constraints: {
                fields: [{ path: ['$.vc.type.*'], filter: { type: 'string', const: 'UniversityDegreeCredential' } }],
              },
            },
          ],
        },
        client_metadata: {
          client_name: 'Example Verifier',
          vp_formats: { jwt_vc_json: { alg: ['EdDSA'] } },
        },
      } as OpenId4VpAuthorizationRequestPayload,
      authorizationRequestUri: 'openid4vp://?request_uri=https%3A%2F%2Fverifier.example.com%2Frequest',
      authorizationRequestId: 'pex-authorization-request-id',
      authorizationResponsePayload: {
        vp_token: 'eyJhbGciOiJFZERTQSJ9.eyJ2cCI6e319.c2lnbmF0dXJl',
        presentation_submission: {
          id: 'presentation-submission-id',
          definition_id: 'presentation-definition-id',
          descriptor_map: [
            {
              id: 'university-degree',
              format: 'jwt_vp_json',
              path: '$',
              path_nested: { id: 'university-degree', format: 'jwt_vc_json', path: '$.vp.verifiableCredential[0]' },
            },
          ],
        },
        state: 'pex-state',
      },
      openId4VpVersion: 'v1.draft24',
    })
    record.updatedAt = updatedAt
    return record
  },

  OpenId4VcVerifierRecord: () => {
    const record = new OpenId4VcVerifierRecord({
      id: 'verifier-record-id',
      createdAt,
      tags: { custom: 'tag' },
      verifierId: 'verifier-id',
      clientMetadata: {
        client_name: 'Example Verifier',
        logo_uri: 'https://verifier.example.com/logo.png',
      },
    })
    record.updatedAt = updatedAt
    record.metadata.set('meta', { key: 'value' })
    return record
  },
})

describe('legacy OpenId4VcIssuanceSessionRecord', () => {
  test('maps the removed CredentialIssued state to Error', () => {
    const record = JsonTransformer.fromJSON(
      {
        id: 'legacy-issuance-session-id',
        createdAt: '2026-01-01T00:00:00.000Z',
        issuerId: 'issuer-id',
        state: 'CredentialIssued',
        issuedCredentials: [],
        credentialOfferPayload: {
          credential_issuer: 'https://issuer.example.com',
          credential_configuration_ids: ['pid-sd-jwt'],
        },
        metadata: {},
        _tags: {},
      },
      OpenId4VcIssuanceSessionRecord
    )

    expect(record.state).toEqual(OpenId4VcIssuanceSessionState.Error)
    expect(JsonTransformer.toJSON(record).state).toEqual(OpenId4VcIssuanceSessionState.Error)
  })
})
