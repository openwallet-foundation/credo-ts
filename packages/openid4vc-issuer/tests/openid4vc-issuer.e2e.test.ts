import type {
  PreAuthorizedCodeFlowConfig,
  AuthorizationCodeFlowConfig,
  IssuerMetadata,
  CredentialSupported,
} from '../src/OpenId4VcIssuerServiceOptions'
import type {
  AgentContext,
  KeyDidCreateOptions,
  VerificationMethod,
  W3cVerifiableCredential,
  W3cVerifyCredentialResult,
} from '@aries-framework/core'
import type { CredentialRequestV1_0_11 } from '@sphereon/oid4vci-common'
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
  equalsIgnoreOrder,
} from '@aries-framework/core'
import { agentDependencies } from '@aries-framework/node'
import { SdJwtVcModule, SdJwtVcService } from '@aries-framework/sd-jwt-vc'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import { cleanAll, enableNetConnect } from 'nock'

import { OpenIdCredentialFormatProfile, OpenId4VcIssuerModule, OpenId4VcIssuerService } from '../src'

type CredentialSupportedWithId = CredentialSupported & { id: string }

const openBadgeCredential = {
  id: 'https://openid4vc-issuer.com/credentials/OpenBadgeCredential',
  format: OpenIdCredentialFormatProfile.JwtVcJson,
  types: ['VerifiableCredential', 'OpenBadgeCredential'],
} satisfies CredentialSupportedWithId

const universityDegreeCredential = {
  id: 'https://openid4vc-issuer.com/credentials/UniversityDegreeCredential',
  format: OpenIdCredentialFormatProfile.JwtVcJson,
  types: ['VerifiableCredential', 'UniversityDegreeCredential'],
} satisfies CredentialSupportedWithId

const universityDegreeCredentialLd = {
  id: 'https://openid4vc-issuer.com/credentials/UniversityDegreeCredentialLd',
  format: OpenIdCredentialFormatProfile.JwtVcJsonLd,
  '@context': [],
  types: ['VerifiableCredential', 'UniversityDegreeCredential'],
} satisfies CredentialSupportedWithId

const universityDegreeCredentialSdJwt = {
  id: 'https://openid4vc-issuer.com/credentials/UniversityDegreeCredentialSdJwt',
  format: OpenIdCredentialFormatProfile.SdJwtVc,
  credential_definition: {
    vct: 'UniversityDegreeCredential',
  },
} satisfies CredentialSupportedWithId

const baseCredentialRequestOptions = {
  scheme: 'openid-credential-offer',
  baseUri: 'openid4vc-issuer.com',
}

const issuerMetadata: IssuerMetadata = {
  credentialIssuer: 'https://openid4vc-issuer.com',
  credentialEndpoint: 'https://openid4vc-issuer.com/credentials',
  tokenEndpoint: 'https://openid4vc-issuer.com/token',
  credentialsSupported: [openBadgeCredential, universityDegreeCredentialLd, universityDegreeCredentialSdJwt],
}

const modules = {
  openId4VcIssuer: new OpenId4VcIssuerModule({ issuerMetadata }),
  sdJwtVc: new SdJwtVcModule(),
  askar: new AskarModule({ ariesAskar }),
}

const jwsService = new JwsService()

const createCredentialRequest = async (
  agentContext: AgentContext,
  options: {
    issuerMetadata: IssuerMetadata
    credentialSupported: CredentialSupportedWithId
    nonce: string
    kid: string
    clientId?: string // use with the authorization code flow,
  }
): Promise<CredentialRequestV1_0_11> => {
  const { credentialSupported, kid, nonce, issuerMetadata, clientId } = options

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

  if (credentialSupported.format === OpenIdCredentialFormatProfile.JwtVcJson) {
    return { ...credentialSupported, proof: { jwt: jws, proof_type: 'jwt' } }
  } else if (
    credentialSupported.format === OpenIdCredentialFormatProfile.JwtVcJsonLd ||
    credentialSupported.format === OpenIdCredentialFormatProfile.LdpVc
  ) {
    return {
      format: credentialSupported.format,
      credential_definition: { '@context': credentialSupported['@context'], types: credentialSupported.types },
      proof: { jwt: jws, proof_type: 'jwt' },
    }
  } else if (credentialSupported.format === OpenIdCredentialFormatProfile.SdJwtVc) {
    return { ...credentialSupported, proof: { jwt: jws, proof_type: 'jwt' } }
  }

  throw new Error('Unsupported format')
}

describe('OpenId4VcIssuer', () => {
  let issuer: Agent<typeof modules>
  let issuerVerificationMethod: VerificationMethod
  let issuerDid: string

  let holder: Agent<typeof modules>
  let holderKid: string
  let holderVerificationMethod: VerificationMethod
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
    const holderDidKey = DidKey.fromDid(holderDid)
    holderKid = `${holderDid}#${holderDidKey.key.fingerprint}`
    const _holderVerificationMethod = holderDidCreateResult.didState.didDocument?.dereferenceKey(holderKid, [
      'authentication',
    ])
    if (!_holderVerificationMethod) throw new Error('No verification method found')
    holderVerificationMethod = _holderVerificationMethod

    const issuerDidCreateResult = await issuer.dids.create<KeyDidCreateOptions>({
      method: 'key',
      options: { keyType: KeyType.Ed25519 },
      secret: { privateKey: TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c7a0fd969598f') },
    })

    issuerDid = issuerDidCreateResult.didState.did as string

    const issuerDidKey = DidKey.fromDid(issuerDid)
    const issuerKid = `${issuerDid}#${issuerDidKey.key.fingerprint}`
    const _issuerVerificationMethod = issuerDidCreateResult.didState.didDocument?.dereferenceKey(issuerKid, [
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

  async function handleCredentialResponse(
    agentContext: AgentContext,
    sphereonVerifiableCredential: SphereonW3cVerifiableCredential,
    credentialSupported: CredentialSupportedWithId
  ) {
    if (credentialSupported.format === 'vc+sd-jwt' && typeof sphereonVerifiableCredential === 'string') {
      const sdJwtVcService = holder.context.dependencyManager.resolve(SdJwtVcService)

      // this throws if invalid
      await sdJwtVcService.fromString(agentContext, sphereonVerifiableCredential, { holderDidUrl: holderKid })
      return
    }

    const w3cCredentialService = holder.context.dependencyManager.resolve(W3cCredentialService)

    let result: W3cVerifyCredentialResult
    let w3cVerifiableCredential: W3cVerifiableCredential

    if (typeof sphereonVerifiableCredential === 'string') {
      if (credentialSupported.format !== 'jwt_vc_json' && credentialSupported.format !== 'jwt_vc_json-ld') {
        throw new Error(`Invalid format. ${credentialSupported.format}`)
      }
      w3cVerifiableCredential = W3cJwtVerifiableCredential.fromSerializedJwt(sphereonVerifiableCredential)
      result = await w3cCredentialService.verifyCredential(holder.context, { credential: w3cVerifiableCredential })
    } else if (credentialSupported.format === 'ldp_vc') {
      if (credentialSupported.format !== 'ldp_vc') throw new Error('Invalid format')
      // validate jwt credentials

      w3cVerifiableCredential = JsonTransformer.fromJSON(sphereonVerifiableCredential, W3cJsonLdVerifiableCredential)
      result = await w3cCredentialService.verifyCredential(holder.context, { credential: w3cVerifiableCredential })
    } else {
      throw new AriesFrameworkError(`Unsupported credential format`)
    }

    if (!result.isValid) {
      holder.context.config.logger.error('Failed to validate credential', { result })
      throw new AriesFrameworkError(`Failed to validate credential, error = ${result.error?.message ?? 'Unknown'}`)
    }

    if (equalsIgnoreOrder(w3cVerifiableCredential.type, credentialSupported.types) === false) {
      throw new Error('Invalid credential type')
    }
    return w3cVerifiableCredential
  }

  it('pre authorized code flow (sdjwtvc)', async () => {
    const cNonce = '1234'
    const preAuthorizedCode = '1234567890'

    await issuerService.cNonceStateManager.set(cNonce, { cNonce: cNonce, createdAt: Date.now(), preAuthorizedCode })

    const preAuthorizedCodeFlowConfig: PreAuthorizedCodeFlowConfig = { preAuthorizedCode, userPinRequired: false }

    const result = await issuer.modules.openId4VcIssuer.createCredentialOfferAndRequest(
      [universityDegreeCredentialSdJwt.id],
      {
        preAuthorizedCodeFlowConfig,
        ...baseCredentialRequestOptions,
      }
    )

    expect(result.credentialOfferRequest).toEqual(
      'openid-credential-offer://openid4vc-issuer.com?credential_offer=%7B%22grants%22%3A%7B%22urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Apre-authorized_code%22%3A%7B%22pre-authorized_code%22%3A%221234567890%22%2C%22user_pin_required%22%3Afalse%7D%7D%2C%22credentials%22%3A%5B%22https%3A%2F%2Fopenid4vc-issuer.com%2Fcredentials%2FUniversityDegreeCredentialSdJwt%22%5D%2C%22credential_issuer%22%3A%22https%3A%2F%2Fopenid4vc-issuer.com%22%7D'
    )

    // TODO:
    const { compact } = await issuer.modules.sdJwtVc.create(
      { type: 'UniversityDegreeCredential', university: 'innsbruck', degree: 'bachelor' },
      {
        holderDidUrl: holderVerificationMethod.id,
        issuerDidUrl: issuerVerificationMethod.id,
        disclosureFrame: { university: true, degree: true },
      }
    )

    const issueCredentialResponse = await issuer.modules.openId4VcIssuer.createIssueCredentialResponse({
      credential: compact,
      verificationMethod: issuerVerificationMethod,
      credentialRequest: await createCredentialRequest(holder.context, {
        credentialSupported: universityDegreeCredentialSdJwt,
        issuerMetadata,
        kid: holderKid,
        nonce: cNonce,
      }),
    })

    const sphereonW3cCredential = issueCredentialResponse.credential
    if (!sphereonW3cCredential) throw new Error('No credential found')

    await handleCredentialResponse(holder.context, sphereonW3cCredential, universityDegreeCredentialSdJwt)
  })

  it('pre authorized code flow (jwtvcjson)', async () => {
    const cNonce = '1234'
    const preAuthorizedCode = '1234567890'

    await issuerService.cNonceStateManager.set(cNonce, { cNonce: cNonce, createdAt: Date.now(), preAuthorizedCode })

    const preAuthorizedCodeFlowConfig: PreAuthorizedCodeFlowConfig = { preAuthorizedCode, userPinRequired: false }

    const result = await issuer.modules.openId4VcIssuer.createCredentialOfferAndRequest([openBadgeCredential.id], {
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
      credentialRequest: await createCredentialRequest(holder.context, {
        credentialSupported: openBadgeCredential,
        issuerMetadata,
        kid: holderKid,
        nonce: cNonce,
      }),
    })

    const sphereonW3cCredential = issueCredentialResponse.credential
    if (!sphereonW3cCredential) throw new Error('No credential found')

    await handleCredentialResponse(holder.context, sphereonW3cCredential, openBadgeCredential)
  })

  it('credential id not in credential supported errors', async () => {
    const cNonce = '1234'
    const preAuthorizedCode = '1234567890'

    await issuerService.cNonceStateManager.set(cNonce, { cNonce: cNonce, createdAt: Date.now(), preAuthorizedCode })

    const preAuthorizedCodeFlowConfig: PreAuthorizedCodeFlowConfig = { preAuthorizedCode, userPinRequired: false }

    await expect(
      issuer.modules.openId4VcIssuer.createCredentialOfferAndRequest(['invalid id'], {
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

    const result = await issuer.modules.openId4VcIssuer.createCredentialOfferAndRequest([openBadgeCredential.id], {
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
        credentialRequest: await createCredentialRequest(holder.context, {
          credentialSupported: openBadgeCredential,
          issuerMetadata,
          kid: holderKid,
          nonce: cNonce,
        }),
      })
    ).rejects.toThrowError()
  })

  it('pre authorized code flow using multiple credentials_supported', async () => {
    const cNonce = '1234'
    const preAuthorizedCode = '1234567890'

    await issuerService.cNonceStateManager.set(cNonce, { cNonce: cNonce, createdAt: Date.now(), preAuthorizedCode })

    const preAuthorizedCodeFlowConfig: PreAuthorizedCodeFlowConfig = { preAuthorizedCode, userPinRequired: false }

    const result = await issuer.modules.openId4VcIssuer.createCredentialOfferAndRequest(
      [openBadgeCredential.id, universityDegreeCredentialLd.id],
      {
        preAuthorizedCodeFlowConfig,
        ...baseCredentialRequestOptions,
      }
    )

    expect(result.credentialOfferRequest).toEqual(
      'openid-credential-offer://openid4vc-issuer.com?credential_offer=%7B%22grants%22%3A%7B%22urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Apre-authorized_code%22%3A%7B%22pre-authorized_code%22%3A%221234567890%22%2C%22user_pin_required%22%3Afalse%7D%7D%2C%22credentials%22%3A%5B%22https%3A%2F%2Fopenid4vc-issuer.com%2Fcredentials%2FOpenBadgeCredential%22%2C%22https%3A%2F%2Fopenid4vc-issuer.com%2Fcredentials%2FUniversityDegreeCredentialLd%22%5D%2C%22credential_issuer%22%3A%22https%3A%2F%2Fopenid4vc-issuer.com%22%7D'
    )

    const credential = new W3cCredential({
      type: universityDegreeCredentialLd.types,
      issuer: new W3cIssuer({ id: issuerDid }),
      credentialSubject: new W3cCredentialSubject({ id: holderDid }),
      issuanceDate: w3cDate(Date.now()),
    })

    const issueCredentialResponse = await issuer.modules.openId4VcIssuer.createIssueCredentialResponse({
      credential,
      verificationMethod: issuerVerificationMethod,
      credentialRequest: await createCredentialRequest(holder.context, {
        credentialSupported: universityDegreeCredentialLd,
        issuerMetadata,
        kid: holderKid,
        nonce: cNonce,
      }),
    })

    const sphereonW3cCredential = issueCredentialResponse.credential
    if (!sphereonW3cCredential) throw new Error('No credential found')

    await handleCredentialResponse(holder.context, sphereonW3cCredential, universityDegreeCredentialLd)
  })

  it('requesting non offered credential errors', async () => {
    const cNonce = '1234'
    const preAuthorizedCode = '1234567890'

    await issuerService.cNonceStateManager.set(cNonce, { cNonce: cNonce, createdAt: Date.now(), preAuthorizedCode })

    const preAuthorizedCodeFlowConfig: PreAuthorizedCodeFlowConfig = {
      preAuthorizedCode,
      userPinRequired: false,
    }

    const result = await issuer.modules.openId4VcIssuer.createCredentialOfferAndRequest([openBadgeCredential.id], {
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
        credentialRequest: await createCredentialRequest(holder.context, {
          credentialSupported: {
            id: 'someid',
            format: openBadgeCredential.format,
            types: universityDegreeCredential.types,
          },
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

    const result = await issuer.modules.openId4VcIssuer.createCredentialOfferAndRequest([openBadgeCredential.id], {
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
      credentialRequest: await createCredentialRequest(holder.context, {
        credentialSupported: openBadgeCredential,
        issuerMetadata,
        kid: holderKid,
        nonce: cNonce,
        clientId: 'required',
      }),
    })

    const sphereonW3cCredential = issueCredentialResponse.credential
    if (!sphereonW3cCredential) throw new Error('No credential found')

    await handleCredentialResponse(holder.context, sphereonW3cCredential, openBadgeCredential)
  })

  it('create credential offer and retrieve it from the uri (pre authorized flow)', async () => {
    const preAuthorizedCode = '1234567890'

    const preAuthorizedCodeFlowConfig: PreAuthorizedCodeFlowConfig = { preAuthorizedCode, userPinRequired: false }

    const credentialOfferUri = 'https://openid4vc-issuer.com/credential-offer-uri'

    const { credentialOfferRequest, credentialOfferPayload } =
      await issuer.modules.openId4VcIssuer.createCredentialOfferAndRequest([openBadgeCredential.id], {
        ...baseCredentialRequestOptions,
        credentialOfferUri,
        preAuthorizedCodeFlowConfig,
      })

    expect(credentialOfferRequest).toEqual(
      `openid-credential-offer://openid4vc-issuer.com?credential_offer_uri=${credentialOfferUri}`
    )

    const credentialOfferReceivedByUri = await issuer.modules.openId4VcIssuer.getCredentialOfferFromUri(
      credentialOfferUri
    )

    expect(credentialOfferPayload).toEqual(credentialOfferReceivedByUri)
  })

  it('create credential offer and retrieve it from the uri (authorizationCodeFlow)', async () => {
    const authorizationCodeFlowConfig: AuthorizationCodeFlowConfig = { issuerState: '1234567890' }
    const credentialOfferUri = 'https://openid4vc-issuer.com/credential-offer-uri'

    const { credentialOfferRequest, credentialOfferPayload } =
      await issuer.modules.openId4VcIssuer.createCredentialOfferAndRequest([openBadgeCredential.id], {
        ...baseCredentialRequestOptions,
        credentialOfferUri,
        authorizationCodeFlowConfig,
      })

    expect(credentialOfferRequest).toEqual(
      `openid-credential-offer://openid4vc-issuer.com?credential_offer_uri=${credentialOfferUri}`
    )

    const credentialOfferReceivedByUri = await issuer.modules.openId4VcIssuer.getCredentialOfferFromUri(
      credentialOfferUri
    )

    expect(credentialOfferPayload).toEqual(credentialOfferReceivedByUri)
  })

  it('offer and request multiple credentials', async () => {
    const cNonce = '1234'
    const preAuthorizedCode = '1234567890'

    await issuerService.cNonceStateManager.set(cNonce, { cNonce: cNonce, createdAt: Date.now(), preAuthorizedCode })

    const preAuthorizedCodeFlowConfig: PreAuthorizedCodeFlowConfig = { preAuthorizedCode, userPinRequired: false }

    const result = await issuer.modules.openId4VcIssuer.createCredentialOfferAndRequest(
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
      credentialRequest: await createCredentialRequest(holder.context, {
        credentialSupported: openBadgeCredential,
        issuerMetadata,
        kid: holderKid,
        nonce: cNonce,
      }),
    })

    const sphereonW3cCredential = issueCredentialResponse.credential
    if (!sphereonW3cCredential) throw new Error('No credential found')

    await handleCredentialResponse(holder.context, sphereonW3cCredential, openBadgeCredential)

    const credential2 = new W3cCredential({
      type: universityDegreeCredential.types,
      issuer: new W3cIssuer({ id: issuerDid }),
      credentialSubject: new W3cCredentialSubject({ id: holderDid }),
      issuanceDate: w3cDate(Date.now()),
    })

    const issueCredentialResponse2 = await issuer.modules.openId4VcIssuer.createIssueCredentialResponse({
      credential: credential2,
      verificationMethod: issuerVerificationMethod,
      credentialRequest: await createCredentialRequest(holder.context, {
        credentialSupported: universityDegreeCredential,
        issuerMetadata,
        kid: holderKid,
        nonce: issueCredentialResponse.c_nonce ?? cNonce,
      }),
    })

    const sphereonW3cCredential2 = issueCredentialResponse2.credential
    if (!sphereonW3cCredential2) throw new Error('No credential found')

    await handleCredentialResponse(holder.context, sphereonW3cCredential2, universityDegreeCredential)
  })
})
