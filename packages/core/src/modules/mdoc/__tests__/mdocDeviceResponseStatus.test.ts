import { Buffer } from 'node:buffer'
import { MediaTypes } from '@owf/token-status-list'
import type { DcqlQuery } from 'dcql'
import nock from 'nock'
import { getAgentOptions } from '../../../../tests'
import { Agent } from '../../../agent/Agent'
import { KnownJwaSignatureAlgorithms, PublicJwk } from '../../kms'
import { TokenStatusListApi } from '../../token-status-list'
import { ClaimFormat } from '../../vc'
import { X509Certificate, X509Service } from '../../x509'
import { Mdoc } from '../Mdoc'
import { MdocDeviceResponse } from '../MdocDeviceResponse'

// Regression tests for the mdoc *presentation* (device response) verification path. The standalone
// `Mdoc.verify` path is covered in `mdocServer.test.ts`; these cases ensure `MdocDeviceResponse.verify`
// applies the same `status ?? issuance` fallback and chain-equality safeguard. The leaf-under-root +
// same-signer status list with `status: undefined` is the Paradym repro that previously failed.

const docType = 'org.iso.18013.5.1.mDL'
const namespace = 'org.iso.18013.5.1'

const verifierGeneratedNonce = 'abcdefg'
const mdocGeneratedNonce = '123456'
const clientId = 'Cq1anPb8vZU5j5C0d7hcsbuJLBpIawUJIDQRi2Ebwb4'
const responseUri = 'http://localhost:4000/api/presentation_request/dc8999df-d6ea-4c84-9985-37a8b81a82ec/callback'

const dcqlQuery = {
  credentials: [
    {
      id: 'mdl-status-test',
      format: ClaimFormat.MsoMdoc,
      multiple: false,
      require_cryptographic_holder_binding: true,
      meta: { doctype_value: docType },
      claims: [{ path: [namespace, 'family_name'] }],
    },
  ],
} satisfies DcqlQuery

const sessionTranscriptOptions = {
  type: 'openId4VpDraft18',
  clientId,
  responseUri,
  verifierGeneratedNonce,
  mdocGeneratedNonce,
} as const

describe('mdoc device-response status list verification', () => {
  const agent = new Agent(getAgentOptions('mdoc-device-response-status', {}))

  let currentDate: Date
  let nextDay: Date

  beforeAll(async () => {
    await agent.initialize()

    currentDate = new Date()
    currentDate.setDate(currentDate.getDate() - 1)
    nextDay = new Date(currentDate)
    nextDay.setDate(currentDate.getDate() + 2)
  })

  afterAll(async () => {
    nock.cleanAll()
    await agent.shutdown()
  })

  const createRootAndLeaf = async (name: string) => {
    const rootKey = await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
    const leafKey = await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })

    const rootCertificate = await X509Service.createCertificate(agent.context, {
      authorityKey: PublicJwk.fromPublicJwk(rootKey.publicJwk),
      validity: { notBefore: currentDate, notAfter: nextDay },
      issuer: `C=DE,CN=${name}Root`,
      extensions: { basicConstraints: { ca: true } },
    })
    rootCertificate.keyId = rootKey.keyId

    const leafCertificate = await X509Service.createCertificate(agent.context, {
      authorityKey: PublicJwk.fromPublicJwk(rootKey.publicJwk),
      subjectPublicKey: PublicJwk.fromPublicJwk(leafKey.publicJwk),
      validity: { notBefore: currentDate, notAfter: nextDay },
      issuer: `C=DE,CN=${name}Root`,
      subject: `C=DE,CN=${name}Leaf`,
    })
    leafCertificate.keyId = leafKey.keyId

    return { rootCertificate, leafCertificate }
  }

  const createStatusList = async (path: string, x5c: X509Certificate[]) => {
    const tokenStatusList = agent.context.resolve(TokenStatusListApi)
    const statusListUri = `https://example.org/token-status-list/${path}`
    const { statusList } = await tokenStatusList.createTokenStatusList({
      format: 'cwt',
      signer: { method: 'x5c', x5c },
      alg: KnownJwaSignatureAlgorithms.ES256,
      statusList: { statusListLength: 10, bitsPerStatus: 1 },
      statusListUri,
    })

    nock('https://example.org')
      .persist()
      .get(`/token-status-list/${path}`)
      .reply(200, Buffer.from(statusList as Uint8Array), { 'Content-Type': MediaTypes.StatusListCwt })

    return statusListUri
  }

  const createDeviceResponse = async (mdoc: Mdoc) => {
    const { encoded } = await MdocDeviceResponse.createDeviceResponseWithDcqlQuery(agent.context, {
      mdocs: [mdoc],
      dcqlQuery,
      sessionTranscriptOptions,
    })

    return MdocDeviceResponse.fromBase64Url(encoded)
  }

  const signMdoc = async (leafCertificate: X509Certificate, statusListUri: string) => {
    const holderKey = await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
    return Mdoc.sign(agent.context, {
      docType,
      holderKey: PublicJwk.fromPublicJwk(holderKey.publicJwk),
      namespaces: { [namespace]: { family_name: 'Jones' } },
      issuerCertificate: leafCertificate,
      validityInfo: { validUntil: nextDay },
      statusInfo: { index: 1, uri: statusListUri },
    })
  }

  test('verify succeeds when status list shares the issuance leaf and only the root is trusted', async () => {
    const { rootCertificate, leafCertificate } = await createRootAndLeaf('Shared')
    const statusListUri = await createStatusList('device-shared', [leafCertificate])
    const mdoc = await signMdoc(leafCertificate, statusListUri)
    const deviceResponse = await createDeviceResponse(mdoc)

    await expect(
      deviceResponse.verify(agent.context, {
        trustedCertificates: [{ issuance: [rootCertificate.toString('base64')] }],
        sessionTranscriptOptions,
      })
    ).resolves.toBeUndefined()
  })

  test('verify fails when status list is anchored to a different root and no status certificates are configured', async () => {
    const { rootCertificate, leafCertificate } = await createRootAndLeaf('Issuance')
    const { leafCertificate: statusLeaf } = await createRootAndLeaf('Status')
    const statusListUri = await createStatusList('device-different', [statusLeaf])
    const mdoc = await signMdoc(leafCertificate, statusListUri)
    const deviceResponse = await createDeviceResponse(mdoc)

    await expect(
      deviceResponse.verify(agent.context, {
        trustedCertificates: [{ issuance: [rootCertificate.toString('base64')] }],
        sessionTranscriptOptions,
      })
    ).rejects.toThrow(`Mdoc with doctype ${docType} is not valid`)
  })

  test('verify fails when status list is signed by a different leaf under the same trusted root', async () => {
    const rootKey = await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
    const issuanceLeafKey = await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
    const statusLeafKey = await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })

    const rootCertificate = await X509Service.createCertificate(agent.context, {
      authorityKey: PublicJwk.fromPublicJwk(rootKey.publicJwk),
      validity: { notBefore: currentDate, notAfter: nextDay },
      issuer: 'C=DE,CN=SiblingRoot',
      extensions: { basicConstraints: { ca: true } },
    })
    rootCertificate.keyId = rootKey.keyId

    const createLeaf = async (leafKey: typeof issuanceLeafKey, commonName: string) => {
      const leaf = await X509Service.createCertificate(agent.context, {
        authorityKey: PublicJwk.fromPublicJwk(rootKey.publicJwk),
        subjectPublicKey: PublicJwk.fromPublicJwk(leafKey.publicJwk),
        validity: { notBefore: currentDate, notAfter: nextDay },
        issuer: 'C=DE,CN=SiblingRoot',
        subject: `C=DE,CN=${commonName}`,
      })
      leaf.keyId = leafKey.keyId
      return leaf
    }

    const issuanceLeaf = await createLeaf(issuanceLeafKey, 'IssuanceLeaf')
    const statusLeaf = await createLeaf(statusLeafKey, 'StatusLeaf')

    const statusListUri = await createStatusList('device-sibling', [statusLeaf])
    const mdoc = await signMdoc(issuanceLeaf, statusListUri)
    const deviceResponse = await createDeviceResponse(mdoc)

    await expect(
      deviceResponse.verify(agent.context, {
        trustedCertificates: [{ issuance: [rootCertificate.toString('base64')] }],
        sessionTranscriptOptions,
      })
    ).rejects.toThrow('Trusted status list chain does not match the trusted issuance chain')
  })

  test('verify succeeds when dedicated status certificates are configured for a different-root status list', async () => {
    const { rootCertificate, leafCertificate } = await createRootAndLeaf('DedicatedIssuance')
    const { rootCertificate: statusRoot, leafCertificate: statusLeaf } = await createRootAndLeaf('DedicatedStatus')
    const statusListUri = await createStatusList('device-dedicated', [statusLeaf])
    const mdoc = await signMdoc(leafCertificate, statusListUri)
    const deviceResponse = await createDeviceResponse(mdoc)

    await expect(
      deviceResponse.verify(agent.context, {
        trustedCertificates: [
          {
            issuance: [rootCertificate.toString('base64')],
            status: [statusRoot.toString('base64')],
          },
        ],
        sessionTranscriptOptions,
      })
    ).resolves.toBeUndefined()
  })
})
