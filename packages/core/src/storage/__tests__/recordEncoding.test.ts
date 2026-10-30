import { readFileSync } from 'node:fs'
import path from 'node:path'
import { testRecordEncoding } from '../../../tests/recordEncoding'
import { SingleContextLruCacheRecord } from '../../modules/cache/singleContextLruCache/SingleContextLruCacheRecord'
import { DidDocument } from '../../modules/dids/domain'
import { DidDocumentRole } from '../../modules/dids/domain/DidDocumentRole'
import { DidRecord } from '../../modules/dids/repository/DidRecord'
import { DidRecordMetadataKeys } from '../../modules/dids/repository/didRecordMetadataTypes'
import { GenericRecord } from '../../modules/generic-records/repository/GenericRecord'
import { sprindFunkeTestVectorBase64Url } from '../../modules/mdoc/__tests__/mdoc.fixtures'
import { MdocVerificationSessionState } from '../../modules/mdoc/MdocVerificationSessionState'
import { MdocRecord } from '../../modules/mdoc/repository/MdocRecord'
import { MdocVerificationSessionRecord } from '../../modules/mdoc/repository/MdocVerificationSessionRecord'
import { SdJwtVcRecord } from '../../modules/sd-jwt-vc/repository/SdJwtVcRecord'
import type { SdJwtVcTypeMetadata } from '../../modules/sd-jwt-vc/typeMetadata'
import { CredoEs256DidJwkJwtVc } from '../../modules/vc/jwt-vc/__tests__/fixtures/credo-jwt-vc'
import { CredoEs256DidJwkJwtVc as CredoEs256DidJwkJwtVcV2 } from '../../modules/vc/jwt-vc/__tests__/fixtures/credo-jwt-vc-v2'
import { Ed25519Signature2018Fixtures } from '../../modules/vc/linked-data-proofs/__tests__/fixtures'
import type { W3cJsonCredential } from '../../modules/vc/models/credential/W3cJsonCredential'
import { W3cCredentialRecord } from '../../modules/vc/repository/W3cCredentialRecord'
import { W3cV2CredentialRecord } from '../../modules/vc/repository/W3cV2CredentialRecord'
import { CredentialMultiInstanceState } from '../../utils/credentialUseTypes'
import { JsonTransformer } from '../../utils/JsonTransformer'
import type { BaseRecordAny } from '../BaseRecord'
import { StorageVersionRecord } from '../migration/repository/StorageVersionRecord'

const fixturesDirectory = path.join(__dirname, '__fixtures__/records')

const createdAt = new Date('2026-01-01T00:00:00.000Z')
const updatedAt = new Date('2026-01-02T00:00:00.000Z')

const compactSdJwtVc =
  'eyJhbGciOiJFZERTQSIsInR5cCI6InZjK3NkLWp3dCIsImtpZCI6Ino2TWt0cXRYTkc4Q0RVWTlQcnJ0b1N0RnplQ25ocE1tZ3hZTDFnaWtjVzNCenZOVyJ9.eyJ2Y3QiOiJJZGVudGl0eUNyZWRlbnRpYWwiLCJmYW1pbHlfbmFtZSI6IkRvZSIsInBob25lX251bWJlciI6IisxLTIwMi01NTUtMDEwMSIsImFkZHJlc3MiOnsic3RyZWV0X2FkZHJlc3MiOiIxMjMgTWFpbiBTdCIsImxvY2FsaXR5IjoiQW55dG93biIsIl9zZCI6WyJOSm5tY3QwQnFCTUUxSmZCbEM2alJRVlJ1ZXZwRU9OaVl3N0E3TUh1SnlRIiwib201Wnp0WkhCLUdkMDBMRzIxQ1ZfeE00RmFFTlNvaWFPWG5UQUpOY3pCNCJdfSwiY25mIjp7Imp3ayI6eyJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI6Im9FTlZzeE9VaUg1NFg4d0pMYVZraWNDUmswMHdCSVE0c1JnYms1NE44TW8ifX0sImlzcyI6ImRpZDprZXk6ejZNa3RxdFhORzhDRFVZOVBycnRvU3RGemVDbmhwTW1neFlMMWdpa2NXM0J6dk5XIiwiaWF0IjoxNjk4MTUxNTMyLCJfc2RfYWxnIjoic2hhLTI1NiIsIl9zZCI6WyIxQ3VyMmsyQTJvSUI1Q3NoU0lmX0FfS2ctbDI2dV9xS3VXUTc5UDBWZGFzIiwiUjF6VFV2T1lIZ2NlcGowakh5cEdIejlFSHR0VktmdDB5c3diYzlFVFBiVSIsImVEcVFwZFRYSlhiV2hmLUVzSTd6dzVYNk92WW1GTi1VWlFRTWVzWHdLUHciLCJwZERrMl9YQUtIbzdnT0Fmd0YxYjdPZENVVlRpdDJrSkhheFNFQ1E5eGZjIiwicHNhdUtVTldFaTA5bnUzQ2w4OXhLWGdtcFdFTlpsNXV5MU4xbnluX2pNayIsInNOX2dlMHBIWEY2cW1zWW5YMUE5U2R3SjhjaDhhRU5reGJPRHNUNzRZd0kiXX0.Yz5U__nC0Nccza-NNfqhp-GueKXqeFNjm_NNtC1AJ2KdmERhCHdO6KNjM7bOiruHlo4oAlj-xObuB9LRiKXeCw~WyJzYWx0IiwiaXNfb3Zlcl82NSIsdHJ1ZV0~WyJzYWx0IiwiaXNfb3Zlcl8yMSIsdHJ1ZV0~WyJzYWx0IiwiaXNfb3Zlcl8xOCIsdHJ1ZV0~WyJzYWx0IiwiYmlydGhkYXRlIiwiMTk0MC0wMS0wMSJd~WyJzYWx0IiwiZW1haWwiLCJqb2huZG9lQGV4YW1wbGUuY29tIl0~WyJzYWx0IiwicmVnaW9uIiwiQW55c3RhdGUiXQ~WyJzYWx0IiwiY291bnRyeSIsIlVTIl0~WyJzYWx0IiwiZ2l2ZW5fbmFtZSIsIkpvaG4iXQ~'

const ldpCredential = Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED as unknown as W3cJsonCredential

const dataIntegrityCredential = JSON.stringify({
  '@context': ['https://www.w3.org/ns/credentials/v2', 'https://w3id.org/security/data-integrity/v2'],
  id: 'urn:uuid:3978344f-8596-4c3a-a978-8fcaba3903c5',
  type: ['VerifiableCredential', 'ExampleCredential'],
  issuer: 'did:key:z6MkqRYqQiSgvZQdnBytw86Qbs2ZWUkGv22od935YF4s8M7V',
  validFrom: '2026-01-01T00:00:00Z',
  credentialSubject: { id: 'did:example:subject', name: 'Alice' },
  proof: {
    type: 'DataIntegrityProof',
    cryptosuite: 'eddsa-rdfc-2022',
    created: '2026-01-01T00:00:00Z',
    verificationMethod:
      'did:key:z6MkqRYqQiSgvZQdnBytw86Qbs2ZWUkGv22od935YF4s8M7V#z6MkqRYqQiSgvZQdnBytw86Qbs2ZWUkGv22od935YF4s8M7V',
    proofPurpose: 'assertionMethod',
    proofValue: 'z58DAdFfa9SkqZMVPxAQpic7ndSayn1PzZs6ZjWp1CktyGesjuTSwRdoWhAfGFCF5bppETSTojQCrfFPP2oumHKtz',
  },
})

const didDocumentJson = {
  '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/suites/ed25519-2018/v1'],
  id: 'did:example:alice',
  alsoKnownAs: ['did:example:alice-alias'],
  controller: ['did:example:alice', 'did:example:controller'],
  verificationMethod: [
    {
      id: 'did:example:alice#key-1',
      type: 'Ed25519VerificationKey2018',
      controller: 'did:example:alice',
      publicKeyBase58: 'CQZzRfoJMRzoESU2VtWrgx3rTsk9yjrjqXL2UdxWjX2q',
    },
    {
      id: 'did:example:alice#key-2',
      type: 'Ed25519VerificationKey2020',
      controller: 'did:example:alice',
      publicKeyMultibase: 'z6MkqRYqQiSgvZQdnBytw86Qbs2ZWUkGv22od935YF4s8M7V',
    },
    {
      id: 'did:example:alice#key-3',
      type: 'JsonWebKey2020',
      controller: 'did:example:alice',
      publicKeyJwk: { kty: 'OKP', crv: 'Ed25519', x: 'oENVsxOUiH54X8wJLaVkicCRk00wBIQ4sRgbk54N8Mo' },
    },
    {
      id: 'did:example:alice#key-4',
      type: 'EcdsaSecp256k1VerificationKey2019',
      controller: 'did:example:alice',
      publicKeyHex: '02b97c30de767f084ce3080168ee293053ba33b235d7116a3263d29f1450936b71',
      blockchainAccountId: 'eip155:1:0x89a932207c485f85226d86f7cd486a89a24fcc12',
      ethereumAddress: '0x89a932207c485f85226d86f7cd486a89a24fcc12',
    },
    {
      id: 'did:example:alice#key-5',
      type: 'RsaVerificationKey2018',
      controller: 'did:example:alice',
      publicKeyPem: '-----BEGIN PUBLIC KEY-----',
      publicKeyBase64: 'AAAA',
    },
  ],
  service: [
    {
      id: 'did:example:alice#did-communication',
      type: 'did-communication',
      serviceEndpoint: 'https://example.com/didcomm',
      recipientKeys: ['did:example:alice#key-1'],
      routingKeys: ['did:example:mediator#key-1'],
      accept: ['didcomm/aip2;env=rfc19'],
      priority: 1,
    },
    {
      id: 'did:example:alice#indy-agent',
      type: 'IndyAgent',
      serviceEndpoint: 'https://example.com/indy',
      recipientKeys: ['CQZzRfoJMRzoESU2VtWrgx3rTsk9yjrjqXL2UdxWjX2q'],
      routingKeys: ['7SbWSgJgjSvSTc7ZAKHJiaZbTBwNM9TdFUAU1UyZfJn8'],
      priority: 2,
    },
    {
      id: 'did:example:alice#didcomm-messaging',
      type: 'DIDCommMessaging',
      serviceEndpoint: {
        uri: 'https://example.com/didcomm/v2',
        routingKeys: ['did:example:mediator#key-2'],
        accept: ['didcomm/v2'],
      },
    },
    {
      id: 'did:example:alice#didcomm-messaging-array',
      type: 'DIDCommMessaging',
      serviceEndpoint: [{ uri: 'https://example.com/didcomm/v2/array', accept: ['didcomm/v2'] }],
    },
    {
      id: 'did:example:alice#didcomm-messaging-legacy',
      type: 'DIDCommMessaging',
      serviceEndpoint: 'https://example.com/didcomm/v2/legacy',
      routingKeys: ['did:example:mediator#key-3'],
      accept: ['didcomm/v2'],
    },
    {
      id: 'did:example:alice#didcomm',
      type: 'DIDComm',
      serviceEndpoint: 'https://example.com/didcomm/legacy',
      routingKeys: ['did:example:mediator#key-4'],
      accept: ['didcomm/v2'],
    },
    {
      id: 'did:example:alice#linked-domains',
      type: 'LinkedDomains',
      serviceEndpoint: { origins: ['https://example.com'] },
    },
  ],
  authentication: [
    'did:example:alice#key-1',
    {
      id: 'did:example:alice#authentication-1',
      type: 'Ed25519VerificationKey2018',
      controller: 'did:example:alice',
      publicKeyBase58: 'CQZzRfoJMRzoESU2VtWrgx3rTsk9yjrjqXL2UdxWjX2q',
    },
  ],
  assertionMethod: [
    'did:example:alice#key-2',
    {
      id: 'did:example:alice#assertion-1',
      type: 'JsonWebKey2020',
      controller: 'did:example:alice',
      publicKeyJwk: { kty: 'OKP', crv: 'Ed25519', x: 'oENVsxOUiH54X8wJLaVkicCRk00wBIQ4sRgbk54N8Mo' },
    },
  ],
  keyAgreement: [
    {
      id: 'did:example:alice#key-agreement-1',
      type: 'X25519KeyAgreementKey2019',
      controller: 'did:example:alice',
      publicKeyBase58: '7SbWSgJgjSvSTc7ZAKHJiaZbTBwNM9TdFUAU1UyZfJn8',
    },
    'did:example:alice#key-3',
  ],
  capabilityInvocation: ['did:example:alice#key-1'],
  capabilityDelegation: [
    {
      id: 'did:example:alice#delegation-1',
      type: 'Ed25519VerificationKey2020',
      controller: 'did:example:alice',
      publicKeyMultibase: 'z6MkqRYqQiSgvZQdnBytw86Qbs2ZWUkGv22od935YF4s8M7V',
    },
  ],
}

// Without svg_templates, as stored by versions that didn't support them
const typeMetadata = {
  vct: 'IdentityCredential',
  name: 'Identity Credential',
  description: 'An identity credential',
  extends: 'https://example.com/BaseCredential',
  display: [
    {
      locale: 'en-US',
      name: 'Identity Credential',
      description: 'An identity credential',
      rendering: {
        simple: {
          logo: { uri: 'https://example.com/logo.png', alt_text: 'Logo' },
          background_color: '#12107c',
          text_color: '#ffffff',
        },
      },
    },
  ],
  claims: [
    {
      path: ['family_name'],
      display: [{ locale: 'en-US', label: 'Family name' }],
      sd: 'always',
    },
    { path: ['address', 'street_address'], sd: 'allowed' },
  ],
} as SdJwtVcTypeMetadata

const baseTypeMetadata: SdJwtVcTypeMetadata = {
  vct: 'https://example.com/BaseCredential',
  name: 'Base Credential',
}

testRecordEncoding(fixturesDirectory, {
  GenericRecord: () => {
    const record = new GenericRecord({
      id: 'generic-record-id',
      createdAt,
      tags: { custom: 'tag' },
      content: { name: 'value', nested: { list: [1, 'two', null, true] } },
    })
    record.updatedAt = updatedAt
    record.metadata.set('meta', { key: 'value' })
    return record
  },

  'DidRecord.withDidDocument': () => {
    const record = new DidRecord({
      id: 'did-record-id',
      createdAt,
      did: 'did:example:alice',
      role: DidDocumentRole.Created,
      didDocument: JsonTransformer.fromJSON(didDocumentJson, DidDocument),
      tags: { alternativeDids: ['did:example:alice-alias'], custom: 'tag' },
      keys: [
        { kmsKeyId: 'kms-key-1', didDocumentRelativeKeyId: '#key-1' },
        { kmsKeyId: 'kms-key-2', didDocumentRelativeKeyId: '#key-agreement-1' },
      ],
    })
    record.updatedAt = updatedAt
    record.metadata.set(DidRecordMetadataKeys.LegacyDid, {
      unqualifiedDid: 'LjgpST2rjsoxYegQDRm7EL',
      didDocumentString: '{"id":"did:sov:LjgpST2rjsoxYegQDRm7EL"}',
    })
    record.metadata.set('custom', { key: 'value' })
    return record
  },

  'DidRecord.withoutDidDocument': () => {
    const record = new DidRecord({
      id: 'did-record-id',
      createdAt,
      did: 'did:example:bob',
      role: DidDocumentRole.Received,
      tags: {
        recipientKeyFingerprints: ['z6MkqRYqQiSgvZQdnBytw86Qbs2ZWUkGv22od935YF4s8M7V'],
        alternativeDids: ['did:example:bob-alias'],
      },
    })
    record.updatedAt = updatedAt
    return record
  },

  MdocRecord: () => {
    const record = new MdocRecord({
      id: 'mdoc-record-id',
      createdAt,
      tags: { custom: 'tag' },
      credentialInstances: [
        { issuerSignedBase64Url: sprindFunkeTestVectorBase64Url, kmsKeyId: 'kms-key-1' },
        { issuerSignedBase64Url: sprindFunkeTestVectorBase64Url },
      ],
    })
    record.multiInstanceState = CredentialMultiInstanceState.MultiInstanceFirstUsed
    record.updatedAt = updatedAt
    record.metadata.set('custom', { key: 'value' })
    return record
  },

  MdocVerificationSessionRecord: () => {
    const record = new MdocVerificationSessionRecord({
      id: 'mdoc-verification-session-record-id',
      createdAt,
      tags: { custom: 'tag' },
      state: MdocVerificationSessionState.Error,
      errorMessage: 'Device response could not be verified',
      deviceRequestBase64Url: 'omd2ZXJzaW9uYzEuMGtkb2NSZXF1ZXN0c4A',
      deviceRequestDefinition: {
        docRequests: [
          {
            docType: 'org.iso.18013.5.1.mDL',
            nameSpaces: {
              'org.iso.18013.5.1': {
                family_name: { intentToRetain: false },
                given_name: { intentToRetain: true, optional: true, source: 'deviceSigned' },
                portrait: { intentToRetain: false, optional: false, source: 'any' },
              },
            },
          },
          {
            docType: 'eu.europa.ec.eudi.pid.1',
            nameSpaces: {
              'eu.europa.ec.eudi.pid.1': {
                age_over_18: { intentToRetain: false, source: 'issuerSigned' },
              },
            },
          },
        ],
        treatAmbiguousMultipleDocRequestsAsAlternatives: true,
      },
      sessionTranscript: {
        type: 'isoMdocDcApi',
        encryptionInfoBase64Url: 'gmVkY2FwaaJlbm9uY2VYIBAgMEBQYHCAkKCwwNDg8Q',
        nonce: 'ECAwQFBgcICQoLDA0ODxA',
        origin: 'https://verifier.example.com',
      },
      sessionKeyId: 'session-key-id',
      expiresAt: new Date('2026-01-01T00:05:00.000Z'),
    })
    record.updatedAt = updatedAt
    record.metadata.set('custom', { key: 'value' })
    return record
  },

  SdJwtVcRecord: () => {
    const record = new SdJwtVcRecord({
      id: 'sd-jwt-vc-record-id',
      createdAt,
      tags: { custom: 'tag' },
      credentialInstances: [{ compactSdJwtVc, kmsKeyId: 'kms-key-1' }, { compactSdJwtVc }],
      typeMetadata,
      typeMetadataChain: [typeMetadata, baseTypeMetadata],
    })
    record.multiInstanceState = CredentialMultiInstanceState.MultiInstanceFirstUsed
    record.updatedAt = updatedAt
    record.metadata.set('custom', { key: 'value' })
    return record
  },

  'W3cCredentialRecord.ldpVc': () => {
    const record = new W3cCredentialRecord({
      id: 'w3c-credential-record-id',
      createdAt,
      tags: { expandedTypes: ['https://www.w3.org/2018/credentials#VerifiableCredential'] },
      credentialInstances: [{ credential: ldpCredential }, { credential: ldpCredential }],
    })
    record.multiInstanceState = CredentialMultiInstanceState.MultiInstanceFirstUsed
    record.updatedAt = updatedAt
    record.metadata.set('custom', { key: 'value' })
    return record
  },

  'W3cCredentialRecord.jwtVc': () => {
    const record = new W3cCredentialRecord({
      id: 'w3c-credential-record-id',
      createdAt,
      tags: {},
      credentialInstances: [{ credential: CredoEs256DidJwkJwtVc }],
    })
    record.updatedAt = updatedAt
    return record
  },

  'W3cV2CredentialRecord.jwtVc': () => {
    const record = new W3cV2CredentialRecord({
      id: 'w3c-v2-credential-record-id',
      createdAt,
      credentialInstances: [{ credential: CredoEs256DidJwkJwtVcV2 }, { credential: CredoEs256DidJwkJwtVcV2 }],
    })
    record.multiInstanceState = CredentialMultiInstanceState.MultiInstanceFirstUsed
    record.setTag('custom', 'tag')
    record.updatedAt = updatedAt
    record.metadata.set('custom', { key: 'value' })
    return record
  },

  'W3cV2CredentialRecord.diVc': () => {
    const record = new W3cV2CredentialRecord({
      id: 'w3c-v2-credential-record-id',
      createdAt,
      credentialInstances: [{ credential: dataIntegrityCredential }],
    })
    record.updatedAt = updatedAt
    return record
  },

  StorageVersionRecord: () => {
    const record = new StorageVersionRecord({ createdAt, storageVersion: '0.5' })
    record.setTag('custom', 'tag')
    record.updatedAt = updatedAt
    record.metadata.set('custom', { key: 'value' })
    return record
  },

  SingleContextLruCacheRecord: () => {
    const record = new SingleContextLruCacheRecord({
      id: 'single-context-lru-cache-record-id',
      createdAt,
      tags: { custom: 'tag' },
      entries: new Map([
        ['object', { value: { name: 'value', nested: { list: [1, 'two', null, true] } }, expiresAt: 1767225600000 }],
        ['string', { value: 'value' }],
        ['number', { value: 10, expiresAt: 1767225600000 }],
        ['array', { value: ['one', 2] }],
      ]),
    })
    record.updatedAt = updatedAt
    record.metadata.set('custom', { key: 'value' })
    return record
  },
})

// Records stored before 0.6 have a single credential property instead of credentialInstances
describe('legacy credential record formats', () => {
  const legacyBase = {
    id: 'legacy-record-id',
    createdAt: createdAt.toISOString(),
    metadata: {},
    _tags: { custom: 'tag' },
  }

  test.each([
    ['MdocRecord', MdocRecord, { base64Url: sprindFunkeTestVectorBase64Url }],
    ['SdJwtVcRecord', SdJwtVcRecord, { compactSdJwtVc }],
    ['W3cCredentialRecord.ldpVc', W3cCredentialRecord, { credential: ldpCredential }],
    ['W3cCredentialRecord.jwtVc', W3cCredentialRecord, { credential: CredoEs256DidJwkJwtVc }],
    ['W3cV2CredentialRecord', W3cV2CredentialRecord, { credential: CredoEs256DidJwkJwtVcV2 }],
  ] as const)('%s', (name, RecordClass, legacyProperties) => {
    const record = JsonTransformer.fromJSON<BaseRecordAny>({ ...legacyBase, ...legacyProperties }, RecordClass)
    const fixture = JSON.parse(readFileSync(path.join(__dirname, `__fixtures__/legacy/${name}.json`), 'utf-8'))

    expect(record).toBeInstanceOf(RecordClass)
    expect(
      JSON.parse(JSON.stringify({ record: JsonTransformer.toJSON(record), tags: record.getTags() }))
    ).toStrictEqual(fixture)
  })
})
