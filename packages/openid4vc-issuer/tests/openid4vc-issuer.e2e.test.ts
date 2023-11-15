import type {
  PreAuthorizedCodeFlowConfig,
  AuthorizationCodeFlowConfig,
  IssuerMetadata,
  CredentialRequest,
} from '../src/OpenId4VcIssuerServiceOptions'
import type {
  AgentContext,
  KeyDidCreateOptions,
  VerificationMethod,
  W3cVerifiableCredential,
  W3cVerifyCredentialResult,
} from '@aries-framework/core'
import type { CredentialSupported } from '@sphereon/oid4vci-common'
import type { OriginalVerifiableCredential as SphereonW3cVerifiableCredential } from '@sphereon/ssi-types'

import { AskarModule } from '@aries-framework/askar'
import {
  Agent,
  AriesFrameworkError,
  DidKey,
  DidsApi,
  JsonTransformer,
  JwsService,
  KeyType,
  TypedArrayEncoder,
  W3cCredential,
  W3cCredentialService,
  W3cCredentialSubject,
  W3cIssuer,
  W3cJsonLdVerifiableCredential,
  W3cJwtVerifiableCredential,
  getJwkFromKey,
  getKeyFromVerificationMethod,
  w3cDate,
} from '@aries-framework/core'
import { agentDependencies } from '@aries-framework/node'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import { cleanAll, enableNetConnect } from 'nock'

import { equalsIgnoreOrder } from '../../core/src/utils/deepEquality'
import { OpenId4VcIssuerModule, OpenId4VcIssuerService } from '../src'

const openBadgeCredential: CredentialSupported & { id: string } = {
  id: 'https://openid4vc-issuer.com/credentials/OpenBadgeCredential',
  format: 'jwt_vc_json',
  types: ['VerifiableCredential', 'OpenBadgeCredential'],
}

const universityDegreeCredential: CredentialSupported & { id: string } = {
  id: 'https://openid4vc-issuer.com/credentials/UniversityDegreeCredential',
  format: 'jwt_vc_json',
  types: ['VerifiableCredential', 'UniversityDegreeCredential'],
}

const baseCredentialRequestOptions = {
  scheme: 'openid-credential-offer',
  baseUri: 'openid4vc-issuer.com',
}

const issuerMetadata: IssuerMetadata = {
  credentialIssuer: 'https://openid4vc-issuer.com',
  credentialEndpoint: 'https://openid4vc-issuer.com/credentials',
  tokenEndpoint: 'https://openid4vc-issuer.com/token',
  credentialsSupported: [openBadgeCredential],
}

const modules = {
  openId4VcIssuer: new OpenId4VcIssuerModule({ issuerMetadata }),
  askar: new AskarModule({ ariesAskar }),
}

const jwsService = new JwsService()

const createCredentialRequestFromKid = async (
  agentContext: AgentContext,
  options: {
    issuerMetadata: IssuerMetadata
    format: 'jwt_vc_json'
    types: string[]
    nonce: string
    kid: string
    clientId?: string // use with the authorization code flow,
  }
): Promise<CredentialRequest> => {
  const { format, types, kid, nonce, issuerMetadata, clientId } = options

  const aud = issuerMetadata.credentialIssuer

  const didsApi = agentContext.dependencyManager.resolve(DidsApi)
  const didDocument = await didsApi.resolveDidDocument(kid)
  if (!didDocument.verificationMethod) {
    throw new AriesFrameworkError(`No verification method found for kid ${kid}`)
  }

  const verificationMethod = didDocument.dereferenceKey(kid, ['authentication', 'assertionMethod'])
  const key = getKeyFromVerificationMethod(verificationMethod)
  const jwk = getJwkFromKey(key)
  const alg = jwk.supportedSignatureAlgorithms[0]

  const rawPayload = {
    iat: Math.floor(Date.now() / 1000), // unix time
    iss: clientId,
    aud,
    nonce,
  }

  const payload = TypedArrayEncoder.fromString(JSON.stringify(rawPayload))
  const typ = 'openid4vci-proof+jwt'

  const jws = await jwsService.createJwsCompact(agentContext, {
    protectedHeaderOptions: { alg, kid, typ },
    payload,
    key,
  })

  // TODO: check different proof types

  return {
    format,
    types,
    proof: { jwt: jws, proof_type: 'jwt' },
  }
}

async function handleCredentialResponse(
  agentContext: AgentContext,
  sphereonVerifiableCredential: SphereonW3cVerifiableCredential,
  format: string,
  types: string[]
) {
  const w3cCredentialService = agentContext.dependencyManager.resolve(W3cCredentialService)

  let result: W3cVerifyCredentialResult
  let w3cVerifiableCredential: W3cVerifiableCredential

  if (typeof sphereonVerifiableCredential === 'string') {
    if (format !== 'jwt_vc_json' && format !== 'ldp_vc') throw new Error('Invalid format')
    // validate json-ld credentials
    w3cVerifiableCredential = W3cJwtVerifiableCredential.fromSerializedJwt(sphereonVerifiableCredential)
    result = await w3cCredentialService.verifyCredential(agentContext, { credential: w3cVerifiableCredential })
  } else if (format === 'ldp_vc') {
    if (format !== 'ldp_vc') throw new Error('Invalid format')
    // validate jwt credentials

    w3cVerifiableCredential = JsonTransformer.fromJSON(sphereonVerifiableCredential, W3cJsonLdVerifiableCredential)
    result = await w3cCredentialService.verifyCredential(agentContext, { credential: w3cVerifiableCredential })
  } else {
    throw new AriesFrameworkError(`Unsupported credential format`)
  }

  if (!result.isValid) {
    agentContext.config.logger.error('Failed to validate credential', { result })
    throw new AriesFrameworkError(`Failed to validate credential, error = ${result.error?.message ?? 'Unknown'}`)
  }

  if (equalsIgnoreOrder(w3cVerifiableCredential.type, types) === false) throw new Error('Invalid credential type')
  return w3cVerifiableCredential
}

describe('OpenId4VcIssuer', () => {
  let issuer: Agent<typeof modules>
  let issuerVerificationMethod: VerificationMethod
  let issuerDid: string

  let holder: Agent<typeof modules>
  let holderKid: string
  let holderDid: string

  let issuerService: OpenId4VcIssuerService

  beforeEach(async () => {
    issuer = new Agent({
      config: {
        label: 'OpenId4VcIssuer Test',
        walletConfig: {
          id: 'openid4vc-Issuer-test',
          key: 'openid4vc-Issuer-test',
        },
      },
      dependencies: agentDependencies,
      modules,
    })

    holder = new Agent({
      config: {
        label: 'OpenId4VciIssuer(Holder) Test',
        walletConfig: {
          id: 'openid4vc-Issuer(Holder)-test',
          key: 'openid4vc-Issuer(Holder)-test',
        },
      },
      dependencies: agentDependencies,
      modules,
    })

    await issuer.initialize()
    await holder.initialize()

    const holderDidCreateResult = await holder.dids.create<KeyDidCreateOptions>({
      method: 'key',
      options: { keyType: KeyType.Ed25519 },
      secret: { privateKey: TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c7a0fd969598e') },
    })

    holderDid = holderDidCreateResult.didState.did as string
    const holderDidKey = DidKey.fromDid(holderDidCreateResult.didState.did as string)
    holderKid = `${holderDidCreateResult.didState.did as string}#${holderDidKey.key.fingerprint}`

    const issuerDidCreateResult = await issuer.dids.create<KeyDidCreateOptions>({
      method: 'key',
      options: { keyType: KeyType.Ed25519 },
      secret: { privateKey: TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c7a0fd969598f') },
    })

    issuerDid = issuerDidCreateResult.didState.did as string

    const verifierDidKey = DidKey.fromDid(issuerDid)
    const verifierKid = `${issuerDidCreateResult.didState.did as string}#${verifierDidKey.key.fingerprint}`
    const _issuerVerificationMethod = issuerDidCreateResult.didState.didDocument?.dereferenceKey(verifierKid, [
      'authentication',
    ])
    if (!_issuerVerificationMethod) throw new Error('No verification method found')
    issuerVerificationMethod = _issuerVerificationMethod

    issuerService = issuer.context.dependencyManager.resolve(OpenId4VcIssuerService)
  })

  afterEach(async () => {
    await issuer.shutdown()
    await issuer.wallet.delete()

    await holder.shutdown()
    await holder.wallet.delete()

    cleanAll()
    enableNetConnect()
  })

  it('pre authorized code flow', async () => {
    const cNonce = '1234'
    const preAuthorizedCode = '1234567890'

    await issuerService.cNonceStateManager.set(cNonce, { cNonce: cNonce, createdAt: Date.now(), preAuthorizedCode })

    const preAuthorizedCodeFlowConfig: PreAuthorizedCodeFlowConfig = { preAuthorizedCode, userPinRequired: false }

    const result = await issuer.modules.openId4VcIssuer.createCredentialOffer([openBadgeCredential.id], {
      preAuthorizedCodeFlowConfig,
      ...baseCredentialRequestOptions,
    })

    expect(result.credentialOfferRequest).toEqual(
      'openid-credential-offer://openid4vc-issuer.com?credential_offer=%7B%22grants%22%3A%7B%22urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Apre-authorized_code%22%3A%7B%22pre-authorized_code%22%3A%221234567890%22%2C%22user_pin_required%22%3Afalse%7D%7D%2C%22credentials%22%3A%5B%22https%3A%2F%2Fopenid4vc-issuer.com%2Fcredentials%2FOpenBadgeCredential%22%5D%2C%22credential_issuer%22%3A%22https%3A%2F%2Fopenid4vc-issuer.com%22%7D'
    )

    const credential = new W3cCredential({
      type: openBadgeCredential.types,
      issuer: new W3cIssuer({ id: issuerDid }),
      credentialSubject: new W3cCredentialSubject({ id: holderDid }),
      issuanceDate: w3cDate(Date.now()),
    })

    const issueCredentialResponse = await issuer.modules.openId4VcIssuer.createIssueCredentialResponse({
      credential,
      verificationMethod: issuerVerificationMethod,
      credentialRequest: await createCredentialRequestFromKid(holder.context, {
        format: openBadgeCredential.format,
        types: openBadgeCredential.types,
        issuerMetadata,
        kid: holderKid,
        nonce: cNonce,
      }),
    })

    const sphereonW3cCredential = issueCredentialResponse.credential
    if (!sphereonW3cCredential) throw new Error('No credential found')

    await handleCredentialResponse(
      holder.context,
      sphereonW3cCredential,
      openBadgeCredential.format,
      openBadgeCredential.types
    )
  })

  it('credential id not in credential supported errors', async () => {
    const cNonce = '1234'
    const preAuthorizedCode = '1234567890'

    await issuerService.cNonceStateManager.set(cNonce, { cNonce: cNonce, createdAt: Date.now(), preAuthorizedCode })

    const preAuthorizedCodeFlowConfig: PreAuthorizedCodeFlowConfig = { preAuthorizedCode, userPinRequired: false }

    await expect(
      issuer.modules.openId4VcIssuer.createCredentialOffer(['invalid id'], {
        //issuerMetadata: {
        //  ...baseIssuerMetadata,
        //  credentialsSupported: [openBadgeCredential, universityDegreeCredential],
        //},
        preAuthorizedCodeFlowConfig,
        ...baseCredentialRequestOptions,
      })
    ).rejects.toThrowError()
  })

  it('issuing non offered credential errors', async () => {
    const cNonce = '1234'
    const preAuthorizedCode = '1234567890'

    await issuerService.cNonceStateManager.set(cNonce, { cNonce: cNonce, createdAt: Date.now(), preAuthorizedCode })

    const preAuthorizedCodeFlowConfig: PreAuthorizedCodeFlowConfig = { preAuthorizedCode, userPinRequired: false }

    const result = await issuer.modules.openId4VcIssuer.createCredentialOffer([openBadgeCredential.id], {
      preAuthorizedCodeFlowConfig,
      ...baseCredentialRequestOptions,
    })

    expect(result.credentialOfferRequest).toEqual(
      'openid-credential-offer://openid4vc-issuer.com?credential_offer=%7B%22grants%22%3A%7B%22urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Apre-authorized_code%22%3A%7B%22pre-authorized_code%22%3A%221234567890%22%2C%22user_pin_required%22%3Afalse%7D%7D%2C%22credentials%22%3A%5B%22https%3A%2F%2Fopenid4vc-issuer.com%2Fcredentials%2FOpenBadgeCredential%22%5D%2C%22credential_issuer%22%3A%22https%3A%2F%2Fopenid4vc-issuer.com%22%7D'
    )

    const credential = new W3cCredential({
      type: universityDegreeCredential.types,
      issuer: new W3cIssuer({ id: issuerDid }),
      credentialSubject: new W3cCredentialSubject({ id: holderDid }),
      issuanceDate: w3cDate(Date.now()),
    })

    await expect(
      issuer.modules.openId4VcIssuer.createIssueCredentialResponse({
        credential,
        verificationMethod: issuerVerificationMethod,
        credentialRequest: await createCredentialRequestFromKid(holder.context, {
          format: openBadgeCredential.format,
          types: openBadgeCredential.types,
          issuerMetadata,
          kid: holderKid,
          nonce: cNonce,
        }),
      })
    ).rejects.toThrowError()
  })

  it('requesting non offered credential errors', async () => {
    const cNonce = '1234'
    const preAuthorizedCode = '1234567890'

    await issuerService.cNonceStateManager.set(cNonce, { cNonce: cNonce, createdAt: Date.now(), preAuthorizedCode })

    const preAuthorizedCodeFlowConfig: PreAuthorizedCodeFlowConfig = {
      preAuthorizedCode,
      userPinRequired: false,
    }

    const result = await issuer.modules.openId4VcIssuer.createCredentialOffer([openBadgeCredential.id], {
      preAuthorizedCodeFlowConfig,
      ...baseCredentialRequestOptions,
    })

    expect(result.credentialOfferRequest).toEqual(
      'openid-credential-offer://openid4vc-issuer.com?credential_offer=%7B%22grants%22%3A%7B%22urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Apre-authorized_code%22%3A%7B%22pre-authorized_code%22%3A%221234567890%22%2C%22user_pin_required%22%3Afalse%7D%7D%2C%22credentials%22%3A%5B%22https%3A%2F%2Fopenid4vc-issuer.com%2Fcredentials%2FOpenBadgeCredential%22%5D%2C%22credential_issuer%22%3A%22https%3A%2F%2Fopenid4vc-issuer.com%22%7D'
    )

    const credential = new W3cCredential({
      type: openBadgeCredential.types,
      issuer: new W3cIssuer({ id: issuerDid }),
      credentialSubject: new W3cCredentialSubject({ id: holderDid }),
      issuanceDate: w3cDate(Date.now()),
    })

    await expect(
      issuer.modules.openId4VcIssuer.createIssueCredentialResponse({
        credential,
        verificationMethod: issuerVerificationMethod,
        credentialRequest: await createCredentialRequestFromKid(holder.context, {
          format: openBadgeCredential.format,
          types: universityDegreeCredential.types,
          issuerMetadata,
          kid: holderKid,
          nonce: cNonce,
        }),
      })
    ).rejects.toThrowError()
  })

  it('authorization code flow', async () => {
    const cNonce = '1234'
    const issuerState = '1234567890'

    await issuerService.cNonceStateManager.set(cNonce, { cNonce: cNonce, createdAt: Date.now(), issuerState })

    const authorizationCodeFlowConfig: AuthorizationCodeFlowConfig = { issuerState }

    const result = await issuer.modules.openId4VcIssuer.createCredentialOffer([openBadgeCredential.id], {
      authorizationCodeFlowConfig,
      ...baseCredentialRequestOptions,
    })

    expect(result.credentialOfferRequest).toEqual(
      `openid-credential-offer://openid4vc-issuer.com?credential_offer=%7B%22grants%22%3A%7B%22authorization_code%22%3A%7B%22issuer_state%22%3A%221234567890%22%7D%7D%2C%22credentials%22%3A%5B%22https%3A%2F%2Fopenid4vc-issuer.com%2Fcredentials%2FOpenBadgeCredential%22%5D%2C%22credential_issuer%22%3A%22https%3A%2F%2Fopenid4vc-issuer.com%22%7D`
    )

    const credential = new W3cCredential({
      type: ['VerifiableCredential', 'OpenBadgeCredential'],
      issuer: new W3cIssuer({ id: issuerDid }),
      credentialSubject: new W3cCredentialSubject({ id: holderDid }),
      issuanceDate: w3cDate(Date.now()),
    })

    const issueCredentialResponse = await issuer.modules.openId4VcIssuer.createIssueCredentialResponse({
      credential,
      verificationMethod: issuerVerificationMethod,
      credentialRequest: await createCredentialRequestFromKid(holder.context, {
        format: openBadgeCredential.format,
        types: openBadgeCredential.types,
        issuerMetadata,
        kid: holderKid,
        nonce: cNonce,
        clientId: 'required',
      }),
    })

    const sphereonW3cCredential = issueCredentialResponse.credential
    if (!sphereonW3cCredential) throw new Error('No credential found')

    await handleCredentialResponse(
      holder.context,
      sphereonW3cCredential,
      openBadgeCredential.format,
      openBadgeCredential.types
    )
  })

  it('create credential offer and retrieve it from the uri (pre authorized flow)', async () => {
    const preAuthorizedCode = '1234567890'

    const preAuthorizedCodeFlowConfig: PreAuthorizedCodeFlowConfig = { preAuthorizedCode, userPinRequired: false }

    const credentialOfferUri = 'https://openid4vc-issuer.com/credential-offer-uri'

    const { credentialOfferRequest, credentialOffer } = await issuer.modules.openId4VcIssuer.createCredentialOffer(
      [openBadgeCredential.id],
      {
        ...baseCredentialRequestOptions,
        credentialOfferUri,
        preAuthorizedCodeFlowConfig,
      }
    )

    expect(credentialOfferRequest).toEqual(
      `openid-credential-offer://openid4vc-issuer.com?credential_offer_uri=${credentialOfferUri}`
    )

    const credentialOfferReceivedByUri = await issuer.modules.openId4VcIssuer.getCredentialOfferFromUri(
      credentialOfferUri
    )

    expect(credentialOffer).toEqual(credentialOfferReceivedByUri)
  })

  it('create credential offer and retrieve it from the uri (authorizationCodeFlow)', async () => {
    const authorizationCodeFlowConfig: AuthorizationCodeFlowConfig = { issuerState: '1234567890' }
    const credentialOfferUri = 'https://openid4vc-issuer.com/credential-offer-uri'

    const { credentialOfferRequest, credentialOffer } = await issuer.modules.openId4VcIssuer.createCredentialOffer(
      [openBadgeCredential.id],
      {
        ...baseCredentialRequestOptions,
        credentialOfferUri,
        authorizationCodeFlowConfig,
      }
    )

    expect(credentialOfferRequest).toEqual(
      `openid-credential-offer://openid4vc-issuer.com?credential_offer_uri=${credentialOfferUri}`
    )

    const credentialOfferReceivedByUri = await issuer.modules.openId4VcIssuer.getCredentialOfferFromUri(
      credentialOfferUri
    )

    expect(credentialOffer).toEqual(credentialOfferReceivedByUri)
  })

  // https://github.com/orgs/hyperledger/projects/32/views/1?pane=issue&itemId=44709598
  xit('offer and request multiple credentials', async () => {
    const cNonce = '1234'
    const preAuthorizedCode = '1234567890'

    await issuerService.cNonceStateManager.set(cNonce, { cNonce: cNonce, createdAt: Date.now(), preAuthorizedCode })

    const preAuthorizedCodeFlowConfig: PreAuthorizedCodeFlowConfig = { preAuthorizedCode, userPinRequired: false }

    const result = await issuer.modules.openId4VcIssuer.createCredentialOffer(
      [
        openBadgeCredential.id,
        {
          format: universityDegreeCredential.format,
          types: universityDegreeCredential.types,
        },
      ],
      {
        preAuthorizedCodeFlowConfig,
        ...baseCredentialRequestOptions,
      }
    )

    expect(result.credentialOfferRequest).toEqual(
      'openid-credential-offer://openid4vc-issuer.com?credential_offer=%7B%22grants%22%3A%7B%22urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Apre-authorized_code%22%3A%7B%22pre-authorized_code%22%3A%221234567890%22%2C%22user_pin_required%22%3Afalse%7D%7D%2C%22credentials%22%3A%5B%22https%3A%2F%2Fopenid4vc-issuer.com%2Fcredentials%2FOpenBadgeCredential%22%2C%7B%22format%22%3A%22jwt_vc_json%22%2C%22types%22%3A%5B%22VerifiableCredential%22%2C%22UniversityDegreeCredential%22%5D%7D%5D%2C%22credential_issuer%22%3A%22https%3A%2F%2Fopenid4vc-issuer.com%22%7D'
    )

    const credential = new W3cCredential({
      type: openBadgeCredential.types,
      issuer: new W3cIssuer({ id: issuerDid }),
      credentialSubject: new W3cCredentialSubject({ id: holderDid }),
      issuanceDate: w3cDate(Date.now()),
    })

    const issueCredentialResponse = await issuer.modules.openId4VcIssuer.createIssueCredentialResponse({
      credential,
      verificationMethod: issuerVerificationMethod,
      credentialRequest: await createCredentialRequestFromKid(holder.context, {
        format: openBadgeCredential.format,
        types: openBadgeCredential.types,
        issuerMetadata,
        kid: holderKid,
        nonce: cNonce,
      }),
    })

    const sphereonW3cCredential = issueCredentialResponse.credential
    if (!sphereonW3cCredential) throw new Error('No credential found')

    await handleCredentialResponse(
      holder.context,
      sphereonW3cCredential,
      openBadgeCredential.format,
      openBadgeCredential.types
    )

    const credential2 = new W3cCredential({
      type: universityDegreeCredential.types,
      issuer: new W3cIssuer({ id: issuerDid }),
      credentialSubject: new W3cCredentialSubject({ id: holderDid }),
      issuanceDate: w3cDate(Date.now()),
    })

    const issueCredentialResponse2 = await issuer.modules.openId4VcIssuer.createIssueCredentialResponse({
      credential: credential2,
      verificationMethod: issuerVerificationMethod,
      credentialRequest: await createCredentialRequestFromKid(holder.context, {
        format: universityDegreeCredential.format,
        types: universityDegreeCredential.types,
        issuerMetadata,
        kid: holderKid,
        nonce: cNonce,
      }),
    })

    const sphereonW3cCredential2 = issueCredentialResponse2.credential
    if (!sphereonW3cCredential2) throw new Error('No credential found')

    await handleCredentialResponse(
      holder.context,
      sphereonW3cCredential,
      universityDegreeCredential.format,
      universityDegreeCredential.types
    )
  })
})
