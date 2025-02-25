import type { AgentType } from './utils'
import type { OpenId4VcVerifierRecord } from '../src'
import type { DcqlQuery } from '@credo-ts/core'

import { ClaimFormat, DateOnly, KeyType, MdocRecord, parseDid, SdJwtVcRecord, X509Service } from '@credo-ts/core'

import { AskarModule } from '../../askar/src'
import { askarModuleConfig } from '../../askar/tests/helpers'
import { TenantsModule } from '../../tenants/src'
import { OpenId4VcHolderModule, OpenId4VcVerifierModule } from '../src'

import { createAgentFromModules } from './utils'

const baseUrl = 'http://localhost:1234'
const verificationBaseUrl = `${baseUrl}/oid4vp`

const dcqlQuery = {
  credentials: [
    {
      id: 'orgeuuniversity',
      format: ClaimFormat.MsoMdoc,
      meta: { doctype_value: 'org.eu.university' },
      claims: [
        { namespace: 'eu.europa.ec.eudi.pid.1', claim_name: 'name' },
        { namespace: 'eu.europa.ec.eudi.pid.1', claim_name: 'degree' },
        { namespace: 'eu.europa.ec.eudi.pid.1', claim_name: 'date' },
      ],
    },
    {
      id: 'OpenBadgeCredentialDescriptor',
      format: 'dc+sd-jwt',
      meta: { vct_values: ['OpenBadgeCredential'] },
      claims: [{ path: ['university'] }],
    },
  ],
} satisfies DcqlQuery

const expectedDcqlResult = {
  queryResult: {
    credentials: [
      {
        id: 'orgeuuniversity',
        format: 'mso_mdoc',
        claims: [
          { namespace: 'eu.europa.ec.eudi.pid.1', claim_name: 'name' },
          { namespace: 'eu.europa.ec.eudi.pid.1', claim_name: 'degree' },
          { namespace: 'eu.europa.ec.eudi.pid.1', claim_name: 'date' },
        ],
        meta: { doctype_value: 'org.eu.university' },
      },
      {
        id: 'OpenBadgeCredentialDescriptor',
        format: 'dc+sd-jwt',
        claims: [{ path: ['university'] }],
        meta: { vct_values: ['OpenBadgeCredential'] },
      },
    ],
    canBeSatisfied: true,
    credential_matches: {
      orgeuuniversity: {
        typed: true,
        success: true,
        output: {
          doctype: 'org.eu.university',
          credential_format: 'mso_mdoc',
          namespaces: {
            'eu.europa.ec.eudi.pid.1': {
              date: expect.any(DateOnly),
              name: 'John Doe',
              degree: 'bachelor',
            },
          },
        },
        input_credential_index: 0,
        claim_set_index: undefined,
        all: expect.any(Array),
        record: expect.any(MdocRecord),
      },
      OpenBadgeCredentialDescriptor: {
        typed: true,
        success: true,
        output: {
          credential_format: 'dc+sd-jwt',
          vct: 'OpenBadgeCredential',
          claims: {
            cnf: {
              kid: 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc#z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc',
            },
            degree: 'bachelor',
            iat: expect.any(Number),
            iss: 'did:key:z6MktiQQEqm2yapXBDt1WEVB3dqgvyzi96FuFANYmrgTrKV9',
            university: 'innsbruck',
            vct: 'OpenBadgeCredential',
          },
        },
        input_credential_index: 1,
        claim_set_index: undefined,
        all: expect.any(Array),
        record: expect.any(SdJwtVcRecord),
      },
    },
    credential_sets: undefined,
  },
  transactionData: [
    {
      transactionDataEntry: {
        type: 'OpenBadgeTx',
        credential_ids: ['OpenBadgeCredentialDescriptor'],
        transaction_data_hashes_alg: ['sha-256'],
      },
      dcql: {
        record: {
          _tags: {
            alg: 'EdDSA',
            sdAlg: 'sha-256',
            vct: 'OpenBadgeCredential',
          },
          type: 'SdJwtVcRecord',
          metadata: {
            data: {},
          },
          id: expect.any(String),
          createdAt: expect.any(Date),
          compactSdJwtVc: expect.any(String),
          updatedAt: expect.any(Date),
        },
        credentialQueryId: 1,
        claimSetId: undefined,
      },
    },
  ],
}

describe('OpenId4Vc', () => {
  let holder: AgentType<{
    openId4VcHolder: OpenId4VcHolderModule
    tenants: TenantsModule<{ openId4VcHolder: OpenId4VcHolderModule }>
  }>

  let verifier: AgentType<{
    openId4VcVerifier: OpenId4VcVerifierModule
    tenants: TenantsModule<{ openId4VcVerifier: OpenId4VcVerifierModule }>
  }>
  let openIdVerifier: OpenId4VcVerifierRecord
  let verifierCertificate: string

  beforeEach(async () => {
    holder = (await createAgentFromModules(
      'holder',
      {
        openId4VcHolder: new OpenId4VcHolderModule(),
        askar: new AskarModule(askarModuleConfig),
      },
      '96213c3d7fc8d4d6754c7a0fd969598e'
    )) as unknown as typeof holder

    verifier = (await createAgentFromModules(
      'verifier',
      {
        openId4VcVerifier: new OpenId4VcVerifierModule({
          baseUrl: verificationBaseUrl,
        }),
        askar: new AskarModule(askarModuleConfig),
        tenants: new TenantsModule(),
      },
      '96213c3d7fc8d4d6754c7a0fd969598f'
    )) as unknown as typeof verifier

    openIdVerifier = await verifier.agent.modules.openId4VcVerifier.createVerifier()

    const signedSdJwtVc = await verifier.agent.sdJwtVc.sign({
      holder: { method: 'did', didUrl: holder.kid },
      issuer: {
        method: 'did',
        didUrl: verifier.kid,
      },
      payload: {
        vct: 'OpenBadgeCredential',
        university: 'innsbruck',
        degree: 'bachelor',
        name: 'John Doe',
      },
      disclosureFrame: {
        _sd: ['university', 'name'],
      },
    })
    await holder.agent.sdJwtVc.store(signedSdJwtVc.compact)

    const selfSignedCertificate = await X509Service.createSelfSignedCertificate(verifier.agent.context, {
      key: await verifier.agent.context.wallet.createKey({ keyType: KeyType.P256 }),
      extensions: [],
      name: 'C=DE',
    })

    await verifier.agent.x509.setTrustedCertificates([selfSignedCertificate.toString('pem')])

    const parsedDid = parseDid(verifier.kid)
    if (!parsedDid.fragment) {
      throw new Error(`didUrl '${parsedDid.didUrl}' does not contain a '#'. Unable to derive key from did document.`)
    }

    const holderKey = await holder.agent.context.wallet.createKey({ keyType: KeyType.P256 })

    const date = new DateOnly()
    const signedMdoc = await verifier.agent.mdoc.sign({
      docType: 'org.eu.university',
      holderKey,
      issuerCertificate: selfSignedCertificate.toString('pem'),
      namespaces: {
        'eu.europa.ec.eudi.pid.1': {
          university: 'innsbruck',
          degree: 'bachelor',
          date: date,
          name: 'John Doe',
          not: 'disclosed',
        },
      },
    })

    const certificate = await verifier.agent.x509.createSelfSignedCertificate({
      key: await verifier.agent.wallet.createKey({ keyType: KeyType.Ed25519 }),
      extensions: [[{ type: 'dns', value: 'localhost:1234' }]],
    })

    verifierCertificate = certificate.toString('base64')
    await holder.agent.mdoc.store(signedMdoc)

    holder.agent.x509.addTrustedCertificate(verifierCertificate)
    verifier.agent.x509.addTrustedCertificate(verifierCertificate)
  })

  afterEach(async () => {
    await holder.agent.shutdown()
    await holder.agent.wallet.delete()

    await verifier.agent.shutdown()
    await verifier.agent.wallet.delete()
  })

  it('Digital Credentials API with dcql, mdoc, sd-jwt, transaction data. unsigned, unencrypted', async () => {
    const { authorizationRequestObject } = await verifier.agent.modules.openId4VcVerifier.createAuthorizationRequest({
      responseMode: 'dc_api',
      expectedOrigins: ['https://example.com'],
      verifierId: openIdVerifier.verifierId,
      requestSigner: {
        method: 'none',
      },
      transactionData: [
        {
          type: 'OpenBadgeTx',
          credential_ids: ['OpenBadgeCredentialDescriptor'],
          transaction_data_hashes_alg: ['sha-256'],
        },
      ],
      dcql: {
        query: dcqlQuery,
      },
    })

    const resolvedAuthorizationRequest = await holder.agent.modules.openId4VcHolder.resolveSiopAuthorizationRequest(
      // FIXME: using authorization request fails here, due to incorrect decoding of url encoded
      // we need to be aware of object types and parse those from string to object
      // https://github.com/openwallet-foundation-labs/oid4vc-ts/issues/42
      authorizationRequestObject,
      { origin: 'https://example.com' }
    )

    expect(resolvedAuthorizationRequest.dcql).toEqual(expectedDcqlResult)
    if (!resolvedAuthorizationRequest.dcql) throw new Error('Dcql not defined')
    const selectedCredentials = holder.agent.modules.openId4VcHolder.selectCredentialsForDcqlRequest(
      resolvedAuthorizationRequest.dcql.queryResult
    )

    const result = await holder.agent.modules.openId4VcHolder.acceptSiopAuthorizationRequest({
      authorizationRequest: resolvedAuthorizationRequest.authorizationRequest,
      dcql: {
        credentials: selectedCredentials,
      },
      origin: resolvedAuthorizationRequest.origin,
    })

    expect(result).toEqual({
      ok: true,
      serverResponse: undefined,
      authorizationResponse: expect.any(Object),
    })
  })

  it('Digital Credentials API with dcql, mdoc, sd-jwt, transaction data. signed, encrypted', async () => {
    const { authorizationRequestObject } = await verifier.agent.modules.openId4VcVerifier.createAuthorizationRequest({
      responseMode: 'dc_api.jwt',
      expectedOrigins: ['https://example.com'],
      verifierId: openIdVerifier.verifierId,
      requestSigner: {
        method: 'x5c',
        x5c: [verifierCertificate],
      },
      transactionData: [
        {
          type: 'OpenBadgeTx',
          credential_ids: ['OpenBadgeCredentialDescriptor'],
          transaction_data_hashes_alg: ['sha-256'],
        },
      ],
      dcql: {
        query: dcqlQuery,
      },
    })

    const resolvedAuthorizationRequest = await holder.agent.modules.openId4VcHolder.resolveSiopAuthorizationRequest(
      authorizationRequestObject,
      { origin: 'https://example.com' }
    )

    expect(resolvedAuthorizationRequest.dcql).toEqual(expectedDcqlResult)
    if (!resolvedAuthorizationRequest.dcql) throw new Error('Dcql not defined')
    const selectedCredentials = holder.agent.modules.openId4VcHolder.selectCredentialsForDcqlRequest(
      resolvedAuthorizationRequest.dcql.queryResult
    )

    const result = await holder.agent.modules.openId4VcHolder.acceptSiopAuthorizationRequest({
      authorizationRequest: resolvedAuthorizationRequest.authorizationRequest,
      dcql: {
        credentials: selectedCredentials,
      },
      origin: resolvedAuthorizationRequest.origin,
    })

    expect(result).toEqual({
      ok: true,
      serverResponse: undefined,
      authorizationResponse: expect.any(Object),
    })
  })
})
