import type { KeyDidCreateOptions } from '@aries-framework/core'

import {
  Agent,
  AriesFrameworkError,
  KeyType,
  TypedArrayEncoder,
  W3cCredentialRecord,
  W3cCredentialsModule,
} from '@aries-framework/core'
import nock, { cleanAll, enableNetConnect } from 'nock'

import { didKeyToInstanceOfKey } from '../../core/src/modules/dids/helpers'
import { customDocumentLoader } from '../../core/src/modules/vc/__tests__/documentLoader'
import { getAgentOptions, indySdk } from '../../core/tests'
import { IndySdkModule } from '../../indy-sdk/src'

import {
  ACCESS_TOKEN_RESPONSE,
  AUTHORIZED_OPENID_CREDENTIAL_OFFER,
  CREDENTIAL_ISSUER_METADATA,
  CREDENTIAL_REQUEST_RESPONSE,
  PRE_AUTHORIZED_OPENID_CREDENTIAL_OFFER,
} from './fixtures'

import { OpenId4VcClientModule } from '@aries-framework/openid4vc-client'

const modules = {
  openId4VcClient: new OpenId4VcClientModule(),
  w3cCredentials: new W3cCredentialsModule({
    documentLoader: customDocumentLoader,
  }),
  indySdk: new IndySdkModule({
    indySdk,
  }),
}

describe('OpenId4VcClient', () => {
  let agent: Agent<typeof modules>

  beforeEach(async () => {
    const agentOptions = getAgentOptions('OpenId4VcClient Agent', {}, modules)

    agent = new Agent(agentOptions)

    await agent.initialize()
  })

  afterEach(async () => {
    await agent.shutdown()
    await agent.wallet.delete()
  })

  beforeAll(async () => {
    nock('https://launchpad.mattrlabs.com')
      .persist()
      .get('/.well-known/openid-credential-issuer')
      .reply(307, undefined, {
        Location: 'https://launchpad.vii.electron.mattrlabs.io/.well-known/openid-credential-issuer',
      })
      .post('/credential')
      .reply(307, undefined, {
        Location: 'https://launchpad.vii.electron.mattrlabs.io/credential',
      })

    nock('https://launchpad.vii.electron.mattrlabs.io')
      .persist()
      .get('/.well-known/openid-credential-issuer')
      .reply(200, CREDENTIAL_ISSUER_METADATA)

      .post('/oidc/v1/auth/token')
      .reply(200, ACCESS_TOKEN_RESPONSE)

      .post('/credential')
      .reply(200, CREDENTIAL_REQUEST_RESPONSE)
  })

  afterAll(async () => {
    cleanAll()
    enableNetConnect()
  })

  describe('Pre-authorized flow', () => {
    const openidCredentialOffer = PRE_AUTHORIZED_OPENID_CREDENTIAL_OFFER

    it('Should successfully execute the pre-authorized flow', async () => {
      const { didState } = await agent.dids.create<KeyDidCreateOptions>({
        method: 'key',
        options: {
          keyType: KeyType.Ed25519,
        },
        secret: {
          privateKey: TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c7a0fd969598e'),
        },
      })

      const did = didState.did as string
      const keyInstance = didKeyToInstanceOfKey(did)
      const kid = `${did}#${keyInstance.fingerprint as string}`

      const w3cCredentialRecord = await agent.modules.openId4VcClient.requestCredentialUsingPreAuthorizedCode({
        clientId: 'test-client',
        openidCredentialOffer,
        kid,
        verifyRevocationState: false,
      })

      expect(w3cCredentialRecord).toBeInstanceOf(W3cCredentialRecord)

      expect(w3cCredentialRecord.credential.type).toEqual([
        'VerifiableCredential',
        'VerifiableCredentialExtension',
        'OpenBadgeCredential',
      ])

      const credentialSubject = w3cCredentialRecord.credential.credentialSubject
      const id = Array.isArray(credentialSubject) ? credentialSubject[0].id : credentialSubject.id
      expect(id).toEqual(did)
    })
  })

  describe('Authorization flow', () => {
    const openidCredentialOffer = AUTHORIZED_OPENID_CREDENTIAL_OFFER

    it('should generate a valid authorization url', async () => {
      const clientId = 'test-client'

      const redirectUri = 'https://example.com/cb'
      const scope = ['TestCredential']

      const { authorizationUrl } = await agent.modules.openId4VcClient.generateAuthorizationUrl({
        clientId,
        redirectUri,
        scope,
        openidCredentialOffer,
      })

      const url = new URL(authorizationUrl)
      const params = url.searchParams

      expect(url.origin).toStrictEqual('https://launchpad.vii.electron.mattrlabs.io')
      expect(url.pathname).toStrictEqual('/oidc/v1/auth/authorize')

      expect(params.get('response_type')).toBe('code')
      expect(params.get('client_id')).toBe(clientId)
      expect(params.get('code_challenge_method')).toBe('S256')
      expect(params.get('redirect_uri')).toBe(redirectUri)
    })

    it('should throw if no scope is provided', async () => {
      expect(
        agent.modules.openId4VcClient.generateAuthorizationUrl({
          clientId: 'test-client',
          redirectUri: 'https://example.org/cb',
          scope: [],
          openidCredentialOffer,
        })
      ).rejects.toThrow(
        new AriesFrameworkError(
          'Only scoped based authorization requests are supported at this time. Please provide at least one scope'
        )
      )
    })

    it('should successfully execute request a credential', async () => {
      const { didState } = await agent.dids.create<KeyDidCreateOptions>({
        method: 'key',
        options: {
          keyType: KeyType.Ed25519,
        },
        secret: {
          privateKey: TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c7a0fd969598e'),
        },
      })

      const did = didState.did as string
      const keyInstance = didKeyToInstanceOfKey(did)
      const kid = `${did}#${keyInstance.fingerprint as string}`

      const clientId = 'test-client'
      const redirectUri = 'https://example.com/cb'
      const scope = ['TestCredential']

      const { codeVerifier } = await agent.modules.openId4VcClient.generateAuthorizationUrl({
        clientId,
        redirectUri,
        scope,
        openidCredentialOffer,
      })
      const w3cCredentialRecord = await agent.modules.openId4VcClient.requestCredentialUsingAuthorizationCode({
        clientId,
        authorizationCode: 'test-code',
        codeVerifier,
        verifyRevocationState: false,
        kid,
        openidCredentialOffer,
        redirectUri,
      })

      expect(w3cCredentialRecord).toBeInstanceOf(W3cCredentialRecord)

      expect(w3cCredentialRecord.credential.type).toEqual([
        'VerifiableCredential',
        'VerifiableCredentialExtension',
        'OpenBadgeCredential',
      ])

      const credentialSubject = w3cCredentialRecord.credential.credentialSubject
      const id = Array.isArray(credentialSubject) ? credentialSubject[0].id : credentialSubject.id
      expect(id).toEqual(did)
    })
  })
})
