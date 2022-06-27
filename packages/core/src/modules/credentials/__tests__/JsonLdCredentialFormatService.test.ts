import type { AgentConfig } from '../../../agent/AgentConfig'
import type { DidDocument, DidDocumentService, VerificationMethod } from '../../dids'
import type { SignCredentialOptionsRFC0593 } from '../../vc/models/W3cCredentialServiceOptions'
import type { CredentialFormatService } from '../formats'
import type { JsonLdAcceptRequestOptions, JsonLdCredentialFormat } from '../formats/jsonld/JsonLdCredentialFormat'
import type { CredentialPreviewAttribute } from '../models/CredentialPreviewAttribute'
import type { V2OfferCredentialMessageOptions } from '../protocol/v2/messages/V2OfferCredentialMessage'
import type { CustomCredentialTags } from '../repository/CredentialExchangeRecord'
import type { CredentialRepository } from '../repository/CredentialRepository'

import { getAgentConfig, mockFunction } from '../../../../tests/helpers'
import { EventEmitter } from '../../../agent/EventEmitter'
import { Attachment, AttachmentData } from '../../../decorators/attachment/Attachment'
import { JsonTransformer } from '../../../utils'
import { JsonEncoder } from '../../../utils/JsonEncoder'
import { DidResolverService } from '../../dids/services/DidResolverService'
import { W3cCredentialService } from '../../vc'
import { Ed25519Signature2018Fixtures } from '../../vc/__tests__/fixtures'
import { W3cVerifiableCredential } from '../../vc/models'
import { W3cCredential } from '../../vc/models/credential/W3cCredential'
import { W3cCredentialRecord } from '../../vc/models/credential/W3cCredentialRecord'
import { JsonLdCredentialFormatService } from '../formats/jsonld/JsonLdCredentialFormatService'
import { CredentialState } from '../models'
import { INDY_CREDENTIAL_OFFER_ATTACHMENT_ID } from '../protocol/v1/messages'
import { V2CredentialPreview } from '../protocol/v2/messages'
import { V2OfferCredentialMessage } from '../protocol/v2/messages/V2OfferCredentialMessage'
import { CredentialExchangeRecord } from '../repository/CredentialExchangeRecord'

jest.mock('../../vc/W3cCredentialService')
jest.mock('../../dids/services/DidResolverService')

const W3cCredentialServiceMock = W3cCredentialService as jest.Mock<W3cCredentialService>
const DidResolverServiceMock = DidResolverService as jest.Mock<DidResolverService>

const didDocument: DidDocument = {
  context: [
    'https://w3id.org/did/v1',
    'https://w3id.org/security/suites/ed25519-2018/v1',
    'https://w3id.org/security/suites/x25519-2019/v1',
  ],
  id: 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
  alsoKnownAs: undefined,
  controller: undefined,
  verificationMethod: [
    {
      id: 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL#z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
      type: 'Ed25519VerificationKey2018',
      controller: 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
      publicKeyBase58: '3Dn1SJNPaCXcvvJvSbsFWP2xaCjMom3can8CQNhWrTRx',
      publicKeyBase64: undefined,
      publicKeyJwk: undefined,
      publicKeyHex: undefined,
      publicKeyMultibase: undefined,
      publicKeyPem: undefined,
      blockchainAccountId: undefined,
      ethereumAddress: undefined,
    },
  ],
  service: undefined,
  authentication: [
    'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL#z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
  ],
  assertionMethod: [
    'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL#z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
  ],
  keyAgreement: [
    {
      id: 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL#z6LSbkodSr6SU2trs8VUgnrnWtSm7BAPG245ggrBmSrxbv1R',
      type: 'X25519KeyAgreementKey2019',
      controller: 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
      publicKeyBase58: '5dTvYHaNaB7mk7iA9LqCJEHG2dGZQsvoi8WGzDRtYEf',
      publicKeyBase64: undefined,
      publicKeyJwk: undefined,
      publicKeyHex: undefined,
      publicKeyMultibase: undefined,
      publicKeyPem: undefined,
      blockchainAccountId: undefined,
      ethereumAddress: undefined,
    },
  ],
  capabilityInvocation: [
    'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL#z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
  ],
  capabilityDelegation: [
    'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL#z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
  ],
  dereferenceVerificationMethod: function (keyId: string): VerificationMethod {
    throw new Error('Function not implemented.')
  },
  dereferenceKey: function (keyId: string, allowedPurposes?: DidPurpose[]): VerificationMethod {
    throw new Error('Function not implemented.')
  },
  getServicesByType: function <S extends DidDocumentService = DidDocumentService>(type: string): S[] {
    throw new Error('Function not implemented.')
  },
  getServicesByClassType: function <S extends DidDocumentService = DidDocumentService>(
    classType: new (...args: never[]) => S
  ): S[] {
    throw new Error('Function not implemented.')
  },
  didCommServices: [],
  recipientKeys: [],
  toJSON: function (): Record<string, any> {
    throw new Error('Function not implemented.')
  },
}
const vcJson = {
  ...Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED,
  credentialSubject: {
    ...Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED.credentialSubject,
    alumniOf: 'oops',
  },
}

const vc = JsonTransformer.fromJSON(vcJson, W3cVerifiableCredential)

const credentialPreview = V2CredentialPreview.fromRecord({
  name: 'John',
  age: '99',
})

const offerAttachment = new Attachment({
  mimeType: 'application/json',
  data: new AttachmentData({
    base64:
      'eyJzY2hlbWFfaWQiOiJhYWEiLCJjcmVkX2RlZl9pZCI6IlRoN01wVGFSWlZSWW5QaWFiZHM4MVk6MzpDTDoxNzpUQUciLCJub25jZSI6Im5vbmNlIiwia2V5X2NvcnJlY3RuZXNzX3Byb29mIjp7fX0',
  }),
})

const credentialAttachment = new Attachment({
  mimeType: 'application/json',
  data: new AttachmentData({
    base64: JsonEncoder.toBase64(vc),
  }),
})
// A record is deserialized to JSON when it's stored into the storage. We want to simulate this behaviour for `offer`
// object to test our service would behave correctly. We use type assertion for `offer` attribute to `any`.
const mockCredentialRecord = ({
  state,
  threadId,
  connectionId,
  tags,
  id,
  credentialAttributes,
}: {
  state?: CredentialState
  tags?: CustomCredentialTags
  threadId?: string
  connectionId?: string
  id?: string
  credentialAttributes?: CredentialPreviewAttribute[]
} = {}) => {
  const offerOptions: V2OfferCredentialMessageOptions = {
    id: '',
    formats: [
      {
        attachId: INDY_CREDENTIAL_OFFER_ATTACHMENT_ID,
        format: 'hlindy/cred-abstract@v2.0',
      },
    ],
    comment: 'some comment',
    credentialPreview: credentialPreview,
    offerAttachments: [offerAttachment],
    replacementId: undefined,
  }
  const offerMessage = new V2OfferCredentialMessage(offerOptions)

  const credentialRecord = new CredentialExchangeRecord({
    id,
    credentialAttributes: credentialAttributes || credentialPreview.attributes,
    state: state || CredentialState.OfferSent,
    threadId: threadId ?? offerMessage.id,
    connectionId: connectionId ?? '123',
    tags,
    protocolVersion: 'v2',
  })

  return credentialRecord
}

const inputDoc = {
  '@context': [
    'https://www.w3.org/2018/credentials/v1',
    'https://w3id.org/citizenship/v1',
    'https://w3id.org/security/bbs/v1',
  ],
  id: 'https://issuer.oidp.uscis.gov/credentials/83627465',
  type: ['VerifiableCredential', 'PermanentResidentCard'],
  issuer: 'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL',
  identifier: '83627465',
  name: 'Permanent Resident Card',
  description: 'Government of Example Permanent Resident Card.',
  issuanceDate: '2019-12-03T12:19:52Z',
  expirationDate: '2029-12-03T12:19:52Z',
  credentialSubject: {
    id: 'did:example:b34ca6cd37bbf23',
    type: ['PermanentResident', 'Person'],
    givenName: 'JOHN',
    familyName: 'SMITH',
    gender: 'Male',
    image: 'data:image/png;base64,iVBORw0KGgokJggg==',
    residentSince: '2015-01-01',
    lprCategory: 'C09',
    lprNumber: '999-999-999',
    commuterClassification: 'C1',
    birthCountry: 'Bahamas',
    birthDate: '1958-07-17',
  },
}
const verificationMethod = `8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K#8HH5gYEeNc3z7PYXmd54d4x6qAfCNrqQqEB3nS7Zfu7K`
const credential = JsonTransformer.fromJSON(inputDoc, W3cCredential)

const signCredentialOptions: SignCredentialOptionsRFC0593 = {
  credential,
  options: {
    proofPurpose: 'assertionMethod',
    proofType: 'Ed25519Signature2018',
  },
}

const requestAttachment = new Attachment({
  mimeType: 'application/json',
  data: new AttachmentData({
    base64: JsonEncoder.toBase64(signCredentialOptions),
  }),
})
let credentialRepository: CredentialRepository
let jsonldFormatService: CredentialFormatService<JsonLdCredentialFormat>
let eventEmitter: EventEmitter
let agentConfig: AgentConfig
let w3cCredentialService: W3cCredentialService
let didResolver: DidResolverService

describe('JsonLd CredentialFormatService', () => {
  beforeEach(async () => {
    agentConfig = getAgentConfig('JsonLdCredentialFormatServiceTest')
    eventEmitter = new EventEmitter(agentConfig)
    w3cCredentialService = new W3cCredentialServiceMock()
    didResolver = new DidResolverServiceMock()
    jsonldFormatService = new JsonLdCredentialFormatService(
      credentialRepository,
      eventEmitter,
      w3cCredentialService,
      didResolver
    )
  })

  describe('Create JsonLd Credential Proposal / Offer', () => {
    test(`Creates JsonLd Credential Proposal`, async () => {
      // when
      const { attachment, format } = await jsonldFormatService.createProposal({
        credentialRecord: mockCredentialRecord(),
        credentialFormats: {
          jsonld: signCredentialOptions,
        },
      })

      // then
      expect(attachment).toMatchObject({
        id: expect.any(String),
        description: undefined,
        filename: undefined,
        mimeType: 'application/json',
        lastmodTime: undefined,
        byteCount: undefined,
        data: {
          base64:
            'eyJjcmVkZW50aWFsIjp7ImNvbnRleHQiOlsiaHR0cHM6Ly93d3cudzMub3JnLzIwMTgvY3JlZGVudGlhbHMvdjEiLCJodHRwczovL3czaWQub3JnL2NpdGl6ZW5zaGlwL3YxIiwiaHR0cHM6Ly93M2lkLm9yZy9zZWN1cml0eS9iYnMvdjEiXSwiaWQiOiJodHRwczovL2lzc3Vlci5vaWRwLnVzY2lzLmdvdi9jcmVkZW50aWFscy84MzYyNzQ2NSIsInR5cGUiOlsiVmVyaWZpYWJsZUNyZWRlbnRpYWwiLCJQZXJtYW5lbnRSZXNpZGVudENhcmQiXSwiaXNzdWVyIjoiZGlkOmtleTp6Nk1rZ2czNDJZY3B1azI2M1I5ZDhBcTZNVWF4UG4xRERlSHlHbzM4RWVmWG1nREwiLCJpZGVudGlmaWVyIjoiODM2Mjc0NjUiLCJuYW1lIjoiUGVybWFuZW50IFJlc2lkZW50IENhcmQiLCJkZXNjcmlwdGlvbiI6IkdvdmVybm1lbnQgb2YgRXhhbXBsZSBQZXJtYW5lbnQgUmVzaWRlbnQgQ2FyZC4iLCJpc3N1YW5jZURhdGUiOiIyMDE5LTEyLTAzVDEyOjE5OjUyWiIsImV4cGlyYXRpb25EYXRlIjoiMjAyOS0xMi0wM1QxMjoxOTo1MloiLCJjcmVkZW50aWFsU3ViamVjdCI6eyJpZCI6ImRpZDpleGFtcGxlOmIzNGNhNmNkMzdiYmYyMyIsInR5cGUiOlsiUGVybWFuZW50UmVzaWRlbnQiLCJQZXJzb24iXSwiZ2l2ZW5OYW1lIjoiSk9ITiIsImZhbWlseU5hbWUiOiJTTUlUSCIsImdlbmRlciI6Ik1hbGUiLCJpbWFnZSI6ImRhdGE6aW1hZ2UvcG5nO2Jhc2U2NCxpVkJPUncwS0dnb2tKZ2dnPT0iLCJyZXNpZGVudFNpbmNlIjoiMjAxNS0wMS0wMSIsImxwckNhdGVnb3J5IjoiQzA5IiwibHByTnVtYmVyIjoiOTk5LTk5OS05OTkiLCJjb21tdXRlckNsYXNzaWZpY2F0aW9uIjoiQzEiLCJiaXJ0aENvdW50cnkiOiJCYWhhbWFzIiwiYmlydGhEYXRlIjoiMTk1OC0wNy0xNyJ9fSwib3B0aW9ucyI6eyJwcm9vZlB1cnBvc2UiOiJhc3NlcnRpb25NZXRob2QiLCJwcm9vZlR5cGUiOiJFZDI1NTE5U2lnbmF0dXJlMjAxOCJ9fQ==',
          json: undefined,
          links: undefined,
          jws: undefined,
          sha256: undefined,
        },
      })

      expect(format).toMatchObject({
        attachId: expect.any(String),
        format: 'aries/ld-proof-vc-detail@v1.0',
      })
    })

    test(`Creates JsonLd Credential Offer`, async () => {
      // when
      const { attachment, previewAttributes, format } = await jsonldFormatService.createOffer({
        credentialFormats: {
          jsonld: signCredentialOptions,
        },
        credentialRecord: mockCredentialRecord(),
      })

      // then
      expect(attachment).toMatchObject({
        id: expect.any(String),
        description: undefined,
        filename: undefined,
        mimeType: 'application/json',
        lastmodTime: undefined,
        byteCount: undefined,
        data: {
          base64:
            'eyJjcmVkZW50aWFsIjp7ImNvbnRleHQiOlsiaHR0cHM6Ly93d3cudzMub3JnLzIwMTgvY3JlZGVudGlhbHMvdjEiLCJodHRwczovL3czaWQub3JnL2NpdGl6ZW5zaGlwL3YxIiwiaHR0cHM6Ly93M2lkLm9yZy9zZWN1cml0eS9iYnMvdjEiXSwiaWQiOiJodHRwczovL2lzc3Vlci5vaWRwLnVzY2lzLmdvdi9jcmVkZW50aWFscy84MzYyNzQ2NSIsInR5cGUiOlsiVmVyaWZpYWJsZUNyZWRlbnRpYWwiLCJQZXJtYW5lbnRSZXNpZGVudENhcmQiXSwiaXNzdWVyIjoiZGlkOmtleTp6Nk1rZ2czNDJZY3B1azI2M1I5ZDhBcTZNVWF4UG4xRERlSHlHbzM4RWVmWG1nREwiLCJpZGVudGlmaWVyIjoiODM2Mjc0NjUiLCJuYW1lIjoiUGVybWFuZW50IFJlc2lkZW50IENhcmQiLCJkZXNjcmlwdGlvbiI6IkdvdmVybm1lbnQgb2YgRXhhbXBsZSBQZXJtYW5lbnQgUmVzaWRlbnQgQ2FyZC4iLCJpc3N1YW5jZURhdGUiOiIyMDE5LTEyLTAzVDEyOjE5OjUyWiIsImV4cGlyYXRpb25EYXRlIjoiMjAyOS0xMi0wM1QxMjoxOTo1MloiLCJjcmVkZW50aWFsU3ViamVjdCI6eyJpZCI6ImRpZDpleGFtcGxlOmIzNGNhNmNkMzdiYmYyMyIsInR5cGUiOlsiUGVybWFuZW50UmVzaWRlbnQiLCJQZXJzb24iXSwiZ2l2ZW5OYW1lIjoiSk9ITiIsImZhbWlseU5hbWUiOiJTTUlUSCIsImdlbmRlciI6Ik1hbGUiLCJpbWFnZSI6ImRhdGE6aW1hZ2UvcG5nO2Jhc2U2NCxpVkJPUncwS0dnb2tKZ2dnPT0iLCJyZXNpZGVudFNpbmNlIjoiMjAxNS0wMS0wMSIsImxwckNhdGVnb3J5IjoiQzA5IiwibHByTnVtYmVyIjoiOTk5LTk5OS05OTkiLCJjb21tdXRlckNsYXNzaWZpY2F0aW9uIjoiQzEiLCJiaXJ0aENvdW50cnkiOiJCYWhhbWFzIiwiYmlydGhEYXRlIjoiMTk1OC0wNy0xNyJ9fSwib3B0aW9ucyI6eyJwcm9vZlB1cnBvc2UiOiJhc3NlcnRpb25NZXRob2QiLCJwcm9vZlR5cGUiOiJFZDI1NTE5U2lnbmF0dXJlMjAxOCJ9fQ==',
          json: undefined,
          links: undefined,
          jws: undefined,
          sha256: undefined,
        },
      })

      expect(previewAttributes).toBeUndefined()

      expect(format).toMatchObject({
        attachId: expect.any(String),
        format: 'aries/ld-proof-vc-detail@v1.0',
      })
    })
  })

  describe('Accept Credential Offer', () => {
    test('returns credential request message base on existing credential offer message', async () => {
      // when
      const { attachment, format } = await jsonldFormatService.acceptOffer({
        credentialFormats: {
          jsonld: undefined,
        },
        offerAttachment,
        credentialRecord: mockCredentialRecord({
          state: CredentialState.OfferReceived,
          threadId: 'fd9c5ddb-ec11-4acd-bc32-540736249746',
          connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
        }),
      })

      // then
      expect(attachment).toMatchObject({
        id: expect.any(String),
        description: undefined,
        filename: undefined,
        mimeType: 'application/json',
        lastmodTime: undefined,
        byteCount: undefined,
        data: {
          base64:
            'eyJzY2hlbWFfaWQiOiJhYWEiLCJjcmVkX2RlZl9pZCI6IlRoN01wVGFSWlZSWW5QaWFiZHM4MVk6MzpDTDoxNzpUQUciLCJub25jZSI6Im5vbmNlIiwia2V5X2NvcnJlY3RuZXNzX3Byb29mIjp7fX0=',
          json: undefined,
          links: undefined,
          jws: undefined,
          sha256: undefined,
        },
      })
      expect(format).toMatchObject({
        attachId: expect.any(String),
        format: 'aries/ld-proof-vc-detail@v1.0',
      })
    })
  })

  describe('Accept Request', () => {
    const threadId = 'fd9c5ddb-ec11-4acd-bc32-540736249746'

    test('Derive Verification Method', async () => {
      mockFunction(didResolver.resolveDidDocument).mockReturnValue(Promise.resolve(didDocument))

      const service = jsonldFormatService as JsonLdCredentialFormatService
      const credentialRequest = requestAttachment.getDataAsJson<SignCredentialOptionsRFC0593>()

      const verificationMethod = await service.deriveVerificationMethod(
        signCredentialOptions.credential,
        credentialRequest
      )
      expect(verificationMethod).toBe(
        'did:key:z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL#z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL'
      )
    })

    test('Creates a credential', async () => {
      // given
      mockFunction(w3cCredentialService.signCredential).mockReturnValue(Promise.resolve(vc))

      const credentialRecord = mockCredentialRecord({
        state: CredentialState.RequestReceived,
        threadId,
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })

      const acceptRequestOptions: JsonLdAcceptRequestOptions = {
        ...signCredentialOptions,
        verificationMethod,
      }

      const { format, attachment } = await jsonldFormatService.acceptRequest({
        credentialRecord,
        credentialFormats: {
          jsonld: acceptRequestOptions,
        },
        requestAttachment,
        offerAttachment,
      })
      //then
      expect(w3cCredentialService.signCredential).toHaveBeenCalledTimes(1)

      expect(attachment).toMatchObject({
        id: expect.any(String),
        description: undefined,
        filename: undefined,
        mimeType: 'application/json',
        lastmodTime: undefined,
        byteCount: undefined,
        data: {
          base64: expect.any(String),
          json: undefined,
          links: undefined,
          jws: undefined,
          sha256: undefined,
        },
      })
      expect(format).toMatchObject({
        attachId: expect.any(String),
        format: 'aries/ld-proof-vc@1.0',
      })
    })
  })

  describe('Process Credential', () => {
    test('finds credential record by thread ID and saves credential attachment into the wallet', async () => {
      const credentialRecord = mockCredentialRecord({
        state: CredentialState.RequestSent,
      })
      const w3c = new W3cCredentialRecord({
        id: 'foo',
        createdAt: new Date(),
        credential: vc,
        tags: {
          expandedTypes: [
            'https://www.w3.org/2018/credentials#VerifiableCredential',
            'https://example.org/examples#UniversityDegreeCredential',
          ],
        },
      })

      // given
      mockFunction(w3cCredentialService.storeCredential).mockReturnValue(Promise.resolve(w3c))

      // when
      await jsonldFormatService.processCredential({ attachment: credentialAttachment, credentialRecord })

      // then
      expect(w3cCredentialService.storeCredential).toHaveBeenCalledTimes(1)
      expect(credentialRecord.credentials.length).toBe(1)
      expect(credentialRecord.credentials[0].credentialRecordType).toBe('w3c')
      expect(credentialRecord.credentials[0].credentialRecordId).toBe('foo')
    })

    test('are credentials equal', async () => {
      const message1 = new Attachment({
        id: 'cdb0669b-7cd6-46bc-b1c7-7034f86083ac',
        mimeType: 'application/json',
        data: new AttachmentData({
          base64: JsonEncoder.toBase64(inputDoc),
        }),
      })

      const message2 = new Attachment({
        id: '9a8ff4fb-ac86-478f-b7f9-fbf3f9cc60e6',
        mimeType: 'application/json',
        data: new AttachmentData({
          base64: JsonEncoder.toBase64(inputDoc),
        }),
      })
      let areCredentialsEqual = jsonldFormatService.areCredentialsEqual(message1, message2)
      expect(areCredentialsEqual).toBe(true)

      const inputDoc2 = {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          'https://w3id.org/citizenship/v1',
          'https://w3id.org/security/bbs/v1',
        ],
      }
      message2.data = new AttachmentData({
        base64: JsonEncoder.toBase64(inputDoc2),
      })
      areCredentialsEqual = jsonldFormatService.areCredentialsEqual(message1, message2)
      expect(areCredentialsEqual).toBe(false)
    })
  })
})
