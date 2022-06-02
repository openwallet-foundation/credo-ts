import type { AgentConfig } from '../../../agent/AgentConfig'
import type { SignCredentialOptions } from '../../vc/models/W3cCredentialServiceOptions'
import type {
  ServiceAcceptRequestOptions,
  ServiceOfferCredentialOptions,
  ServiceRequestCredentialOptions,
} from '../CredentialServiceOptions'
import type { ProposeCredentialOptions } from '../CredentialsModuleOptions'
import type { CredentialFormatService } from '../formats'
import type { CredentialPreviewAttribute } from '../models/CredentialPreviewAttribute'
import type { IndyCredentialMetadata } from '../protocol/v1/models/CredentialInfo'
import type { V2OfferCredentialMessageOptions } from '../protocol/v2/messages/V2OfferCredentialMessage'
import type { CustomCredentialTags } from '../repository/CredentialExchangeRecord'
import type { CredentialRepository } from '../repository/CredentialRepository'

import { getAgentConfig, getMockConnection, mockFunction } from '../../../../tests/helpers'
import { EventEmitter } from '../../../agent/EventEmitter'
import { Attachment, AttachmentData } from '../../../decorators/attachment/Attachment'
import { JsonTransformer } from '../../../utils'
import { JsonEncoder } from '../../../utils/JsonEncoder'
import { DidExchangeState } from '../../connections/models/DidExchangeState'
import { W3cCredentialService } from '../../vc'
import { Ed25519Signature2018Fixtures } from '../../vc/__tests__/fixtures'
import { W3cVerifiableCredential } from '../../vc/models'
import { W3cCredential } from '../../vc/models/credential/W3cCredential'
import { W3cCredentialRecord } from '../../vc/models/credential/W3cCredentialRecord'
import { CredentialProtocolVersion } from '../CredentialProtocolVersion'
import { CredentialState } from '../CredentialState'
import { CredentialUtils } from '../CredentialUtils'
import { CredentialFormatType } from '../CredentialsModuleOptions'
import { JsonLdCredentialFormatService } from '../formats/jsonld/JsonLdCredentialFormatService'
import { INDY_CREDENTIAL_OFFER_ATTACHMENT_ID } from '../protocol/v1/messages'
import { V2CredentialPreview } from '../protocol/v2/V2CredentialPreview'
import { V2OfferCredentialMessage } from '../protocol/v2/messages/V2OfferCredentialMessage'
import { CredentialMetadataKeys } from '../repository'
import { CredentialExchangeRecord } from '../repository/CredentialExchangeRecord'

import { credReq } from './fixtures'

jest.mock('../../vc/W3cCredentialService')

const W3cCredentialServiceMock = W3cCredentialService as jest.Mock<W3cCredentialService>

const vcJson = {
  ...Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED,
  credentialSubject: {
    ...Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED.credentialSubject,
    alumniOf: 'oops',
  },
  id: 'foo',
}

const vc = JsonTransformer.fromJSON(vcJson, W3cVerifiableCredential)

const connection = getMockConnection({
  id: '123',
  state: DidExchangeState.Completed,
})

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

const requestAttachment = new Attachment({
  mimeType: 'application/json',
  data: new AttachmentData({
    base64: JsonEncoder.toBase64(credReq),
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
  metadata,
  threadId,
  connectionId,
  tags,
  id,
  credentialAttributes,
}: {
  state?: CredentialState
  metadata?: IndyCredentialMetadata & { indyRequest: Record<string, unknown> }
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
    protocolVersion: CredentialProtocolVersion.V2,
  })

  if (metadata?.indyRequest) {
    credentialRecord.metadata.set(CredentialMetadataKeys.IndyRequest, { ...metadata.indyRequest })
  }

  if (metadata?.schemaId) {
    credentialRecord.metadata.add(CredentialMetadataKeys.IndyCredential, {
      schemaId: metadata.schemaId,
    })
  }

  if (metadata?.credentialDefinitionId) {
    credentialRecord.metadata.add(CredentialMetadataKeys.IndyCredential, {
      credentialDefinitionId: metadata.credentialDefinitionId,
    })
  }

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

let credentialRepository: CredentialRepository
let jsonldFormatService: CredentialFormatService
let eventEmitter: EventEmitter
let agentConfig: AgentConfig
let credentialRecord: CredentialExchangeRecord
let w3cCredentialService: W3cCredentialService
let signCredentialOptions: SignCredentialOptions

describe('JsonLd CredentialFormatService', () => {
  beforeEach(async () => {
    agentConfig = getAgentConfig('JsonLdCredentialFormatServiceTest')
    eventEmitter = new EventEmitter(agentConfig)
    w3cCredentialService = new W3cCredentialServiceMock()
    signCredentialOptions = {
      credential,
      proofType: 'Ed25519Signature2018',
      verificationMethod,
    }
    jsonldFormatService = new JsonLdCredentialFormatService(credentialRepository, eventEmitter, w3cCredentialService)
  })

  describe('Create JsonLd Credential Proposal / Offer', () => {
    let offerOptions: ServiceOfferCredentialOptions
    let proposeOptions: ProposeCredentialOptions

    beforeEach(async () => {
      proposeOptions = {
        connectionId: connection.id,
        protocolVersion: CredentialProtocolVersion.V2,
        credentialFormats: {
          jsonld: signCredentialOptions,
        },
        comment: 'v2 propose credential test for W3C Credentials',
      }
      offerOptions = {
        comment: 'V2 Out of Band offer (W3C)',
        credentialFormats: {
          jsonld: signCredentialOptions,
        },
        protocolVersion: CredentialProtocolVersion.V2,
        connectionId: '',
      }
    })

    test(`Creates JsonLd Credential Proposal`, async () => {
      // when
      const { attachment, format } = await jsonldFormatService.createProposal(proposeOptions)

      // then
      expect(attachment).toMatchObject({
        id: 'ld_proof',
        description: undefined,
        filename: undefined,
        mimeType: 'application/json',
        lastmodTime: undefined,
        byteCount: undefined,
        data: {
          base64:
            'eyJjcmVkZW50aWFsIjp7ImNvbnRleHQiOlsiaHR0cHM6Ly93d3cudzMub3JnLzIwMTgvY3JlZGVudGlhbHMvdjEiLCJodHRwczovL3czaWQub3JnL2NpdGl6ZW5zaGlwL3YxIiwiaHR0cHM6Ly93M2lkLm9yZy9zZWN1cml0eS9iYnMvdjEiXSwiaWQiOiJodHRwczovL2lzc3Vlci5vaWRwLnVzY2lzLmdvdi9jcmVkZW50aWFscy84MzYyNzQ2NSIsInR5cGUiOlsiVmVyaWZpYWJsZUNyZWRlbnRpYWwiLCJQZXJtYW5lbnRSZXNpZGVudENhcmQiXSwiaXNzdWVyIjoiZGlkOmtleTp6Nk1rZ2czNDJZY3B1azI2M1I5ZDhBcTZNVWF4UG4xRERlSHlHbzM4RWVmWG1nREwiLCJpZGVudGlmaWVyIjoiODM2Mjc0NjUiLCJuYW1lIjoiUGVybWFuZW50IFJlc2lkZW50IENhcmQiLCJkZXNjcmlwdGlvbiI6IkdvdmVybm1lbnQgb2YgRXhhbXBsZSBQZXJtYW5lbnQgUmVzaWRlbnQgQ2FyZC4iLCJpc3N1YW5jZURhdGUiOiIyMDE5LTEyLTAzVDEyOjE5OjUyWiIsImV4cGlyYXRpb25EYXRlIjoiMjAyOS0xMi0wM1QxMjoxOTo1MloiLCJjcmVkZW50aWFsU3ViamVjdCI6eyJpZCI6ImRpZDpleGFtcGxlOmIzNGNhNmNkMzdiYmYyMyIsInR5cGUiOlsiUGVybWFuZW50UmVzaWRlbnQiLCJQZXJzb24iXSwiZ2l2ZW5OYW1lIjoiSk9ITiIsImZhbWlseU5hbWUiOiJTTUlUSCIsImdlbmRlciI6Ik1hbGUiLCJpbWFnZSI6ImRhdGE6aW1hZ2UvcG5nO2Jhc2U2NCxpVkJPUncwS0dnb2tKZ2dnPT0iLCJyZXNpZGVudFNpbmNlIjoiMjAxNS0wMS0wMSIsImxwckNhdGVnb3J5IjoiQzA5IiwibHByTnVtYmVyIjoiOTk5LTk5OS05OTkiLCJjb21tdXRlckNsYXNzaWZpY2F0aW9uIjoiQzEiLCJiaXJ0aENvdW50cnkiOiJCYWhhbWFzIiwiYmlydGhEYXRlIjoiMTk1OC0wNy0xNyJ9fSwicHJvb2ZUeXBlIjoiRWQyNTUxOVNpZ25hdHVyZTIwMTgiLCJ2ZXJpZmljYXRpb25NZXRob2QiOiI4SEg1Z1lFZU5jM3o3UFlYbWQ1NGQ0eDZxQWZDTnJxUXFFQjNuUzdaZnU3SyM4SEg1Z1lFZU5jM3o3UFlYbWQ1NGQ0eDZxQWZDTnJxUXFFQjNuUzdaZnU3SyJ9',
          json: undefined,
          links: undefined,
          jws: undefined,
          sha256: undefined,
        },
      })

      expect(format).toMatchObject({
        attachId: 'ld_proof',
        format: 'aries/ld-proof-vc-detail@v1.0',
      })
    })
    test(`Creates JsonLd Credential Offer`, async () => {
      // when
      const { attachment, preview, format } = await jsonldFormatService.createOffer(offerOptions)

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
            'eyJjcmVkZW50aWFsIjp7ImNvbnRleHQiOlsiaHR0cHM6Ly93d3cudzMub3JnLzIwMTgvY3JlZGVudGlhbHMvdjEiLCJodHRwczovL3czaWQub3JnL2NpdGl6ZW5zaGlwL3YxIiwiaHR0cHM6Ly93M2lkLm9yZy9zZWN1cml0eS9iYnMvdjEiXSwiaWQiOiJodHRwczovL2lzc3Vlci5vaWRwLnVzY2lzLmdvdi9jcmVkZW50aWFscy84MzYyNzQ2NSIsInR5cGUiOlsiVmVyaWZpYWJsZUNyZWRlbnRpYWwiLCJQZXJtYW5lbnRSZXNpZGVudENhcmQiXSwiaXNzdWVyIjoiZGlkOmtleTp6Nk1rZ2czNDJZY3B1azI2M1I5ZDhBcTZNVWF4UG4xRERlSHlHbzM4RWVmWG1nREwiLCJpZGVudGlmaWVyIjoiODM2Mjc0NjUiLCJuYW1lIjoiUGVybWFuZW50IFJlc2lkZW50IENhcmQiLCJkZXNjcmlwdGlvbiI6IkdvdmVybm1lbnQgb2YgRXhhbXBsZSBQZXJtYW5lbnQgUmVzaWRlbnQgQ2FyZC4iLCJpc3N1YW5jZURhdGUiOiIyMDE5LTEyLTAzVDEyOjE5OjUyWiIsImV4cGlyYXRpb25EYXRlIjoiMjAyOS0xMi0wM1QxMjoxOTo1MloiLCJjcmVkZW50aWFsU3ViamVjdCI6eyJpZCI6ImRpZDpleGFtcGxlOmIzNGNhNmNkMzdiYmYyMyIsInR5cGUiOlsiUGVybWFuZW50UmVzaWRlbnQiLCJQZXJzb24iXSwiZ2l2ZW5OYW1lIjoiSk9ITiIsImZhbWlseU5hbWUiOiJTTUlUSCIsImdlbmRlciI6Ik1hbGUiLCJpbWFnZSI6ImRhdGE6aW1hZ2UvcG5nO2Jhc2U2NCxpVkJPUncwS0dnb2tKZ2dnPT0iLCJyZXNpZGVudFNpbmNlIjoiMjAxNS0wMS0wMSIsImxwckNhdGVnb3J5IjoiQzA5IiwibHByTnVtYmVyIjoiOTk5LTk5OS05OTkiLCJjb21tdXRlckNsYXNzaWZpY2F0aW9uIjoiQzEiLCJiaXJ0aENvdW50cnkiOiJCYWhhbWFzIiwiYmlydGhEYXRlIjoiMTk1OC0wNy0xNyJ9fSwicHJvb2ZUeXBlIjoiRWQyNTUxOVNpZ25hdHVyZTIwMTgiLCJ2ZXJpZmljYXRpb25NZXRob2QiOiI4SEg1Z1lFZU5jM3o3UFlYbWQ1NGQ0eDZxQWZDTnJxUXFFQjNuUzdaZnU3SyM4SEg1Z1lFZU5jM3o3UFlYbWQ1NGQ0eDZxQWZDTnJxUXFFQjNuUzdaZnU3SyJ9',
          json: undefined,
          links: undefined,
          jws: undefined,
          sha256: undefined,
        },
      })

      expect(preview).toMatchObject({
        type: 'https://didcomm.org/issue-credential/2.0/credential-preview',
        attributes: [],
      })

      expect(format).toMatchObject({
        attachId: expect.any(String),
        format: 'aries/ld-proof-vc-detail@v1.0',
      })
    })
  })

  describe('Create Credential Request', () => {
    beforeEach(() => {
      credentialRecord = mockCredentialRecord({
        state: CredentialState.OfferReceived,
        threadId: 'fd9c5ddb-ec11-4acd-bc32-540736249746',
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })
    })

    test('returns credential request message base on existing credential offer message', async () => {
      // given
      const options: ServiceRequestCredentialOptions = {
        connectionId: credentialRecord.connectionId,
        comment: 'credential request comment',
        credentialFormats: {
          jsonld: signCredentialOptions,
        },
        offerAttachment,
      }
      // when
      const { attachment, format } = await jsonldFormatService.createRequest(options, credentialRecord)

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

  describe('Create (Issue) Credential', () => {
    const threadId = 'fd9c5ddb-ec11-4acd-bc32-540736249746'
    let credentialRecord: CredentialExchangeRecord
    let serviceOptions: ServiceAcceptRequestOptions

    beforeEach(() => {
      credentialRecord = mockCredentialRecord({
        state: CredentialState.RequestReceived,
        threadId,
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })

      serviceOptions = {
        credentialRecordId: credentialRecord.id,
        comment: 'V2 JsonLd Credential',
      }
      mockFunction(w3cCredentialService.signCredential).mockReturnValue(Promise.resolve(vc))
    })

    test('Creates a credential', async () => {
      // given
      const issuerSpy = jest.spyOn(w3cCredentialService, 'signCredential')

      // when

      const { format, attachment } = await jsonldFormatService.createCredential(
        serviceOptions,
        credentialRecord,
        requestAttachment,
        offerAttachment
      )

      //then
      expect(issuerSpy).toHaveBeenCalledTimes(1)

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
    beforeEach(() => {
      credentialRecord = mockCredentialRecord({
        state: CredentialState.RequestSent,
      })
      const props = {
        id: 'foo',
        createdAt: new Date(),
        credential: vc,
        tags: {
          expandedTypes: [
            'https://www.w3.org/2018/credentials#VerifiableCredential',
            'https://example.org/examples#UniversityDegreeCredential',
          ],
        },
      }
      const w3c = new W3cCredentialRecord(props)
      mockFunction(w3cCredentialService.storeCredential).mockReturnValue(Promise.resolve(w3c))
    })

    test('finds credential record by thread ID and saves credential attachment into the wallet', async () => {
      // given
      const issuerSpy = jest.spyOn(w3cCredentialService, 'storeCredential')

      // when
      await jsonldFormatService.processCredential({ credentialAttachment }, credentialRecord)

      // then
      expect(issuerSpy).toHaveBeenCalledTimes(1)
      expect(credentialRecord.credentials.length).toBe(1)
      expect(credentialRecord.credentials[0].credentialRecordType).toBe(CredentialFormatType.JsonLd)
      expect(credentialRecord.credentials[0].credentialRecordId).toBe('foo')
    })
  })
})
