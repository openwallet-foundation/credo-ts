import type { AgentConfig } from '../../../agent/AgentConfig'
import type { ParseRevocationRegistryDefinitionTemplate } from '../../ledger/services/IndyLedgerService'
import type {
  ServiceAcceptRequestOptions,
  ServiceOfferCredentialOptions,
  ServiceRequestCredentialOptions,
} from '../CredentialServiceOptions'
import type { ProposeCredentialOptions } from '../CredentialsModuleOptions'
import type { CredentialFormatService } from '../formats'
import type { FormatServiceRequestCredentialFormats } from '../formats/models/CredentialFormatServiceOptions'
import type { CredentialPreviewAttribute } from '../models/CredentialPreviewAttribute'
import type { IndyCredentialMetadata } from '../protocol/v1/models/CredentialInfo'
import type { V2OfferCredentialMessageOptions } from '../protocol/v2/messages/V2OfferCredentialMessage'
import type { CustomCredentialTags } from '../repository/CredentialExchangeRecord'
import type { CredentialRepository } from '../repository/CredentialRepository'
import type { RevocRegDef } from 'indy-sdk'

import { getAgentConfig, getMockConnection, mockFunction } from '../../../../tests/helpers'
import { EventEmitter } from '../../../agent/EventEmitter'
import { Attachment, AttachmentData } from '../../../decorators/attachment/Attachment'
import { JsonEncoder } from '../../../utils/JsonEncoder'
import { DidExchangeState } from '../../connections/models/DidExchangeState'
import { IndyHolderService } from '../../indy/services/IndyHolderService'
import { IndyIssuerService } from '../../indy/services/IndyIssuerService'
import { IndyLedgerService } from '../../ledger/services/IndyLedgerService'
import { CredentialProtocolVersion } from '../CredentialProtocolVersion'
import { CredentialState } from '../CredentialState'
import { CredentialUtils } from '../CredentialUtils'
import { CredentialFormatType } from '../CredentialsModuleOptions'
import { IndyCredentialFormatService } from '../formats'
import {
  INDY_CREDENTIAL_ATTACHMENT_ID,
  INDY_CREDENTIAL_OFFER_ATTACHMENT_ID,
  INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID,
} from '../protocol/v1/messages'
import { V2CredentialPreview } from '../protocol/v2/V2CredentialPreview'
import { V2OfferCredentialMessage } from '../protocol/v2/messages/V2OfferCredentialMessage'
import { CredentialMetadataKeys } from '../repository'
import { CredentialExchangeRecord } from '../repository/CredentialExchangeRecord'

import { credDef, credReq, schema } from './fixtures'

jest.mock('../../../modules/ledger/services/IndyLedgerService')
jest.mock('../../indy/services/IndyHolderService')
jest.mock('../../indy/services/IndyIssuerService')

const IndyLedgerServiceMock = IndyLedgerService as jest.Mock<IndyLedgerService>
const IndyHolderServiceMock = IndyHolderService as jest.Mock<IndyHolderService>
const IndyIssuerServiceMock = IndyIssuerService as jest.Mock<IndyIssuerService>

const values = {
  ['x']: {
    raw: 'x',
    encoded: 'y',
  },
}
const cred = {
  schema_id: 'xsxs',
  cred_def_id: 'xdxd',
  rev_reg_id: 'x',
  values: values,
  signature: undefined,
  signature_correctness_proof: undefined,
}
const revDef: RevocRegDef = {
  id: 'x',
  revocDefType: 'CL_ACCUM',
  tag: 'x',
  credDefId: 'x',
  value: {
    issuanceType: 'ISSUANCE_BY_DEFAULT',
    maxCredNum: 33,
    tailsHash: 'd',
    tailsLocation: 'x',
    publicKeys: ['x'],
  },
  ver: 't',
}
const revocationTemplate: ParseRevocationRegistryDefinitionTemplate = {
  revocationRegistryDefinition: revDef,
  revocationRegistryDefinitionTxnTime: 42,
}
const connection = getMockConnection({
  id: '123',
  state: DidExchangeState.Completed,
})

const credentialPreview = V2CredentialPreview.fromRecord({
  name: 'John',
  age: '99',
})

const offerAttachment = new Attachment({
  id: INDY_CREDENTIAL_OFFER_ATTACHMENT_ID,
  mimeType: 'application/json',
  data: new AttachmentData({
    base64:
      'eyJzY2hlbWFfaWQiOiJhYWEiLCJjcmVkX2RlZl9pZCI6IlRoN01wVGFSWlZSWW5QaWFiZHM4MVk6MzpDTDoxNzpUQUciLCJub25jZSI6Im5vbmNlIiwia2V5X2NvcnJlY3RuZXNzX3Byb29mIjp7fX0',
  }),
})

const requestAttachment = new Attachment({
  id: INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID,
  mimeType: 'application/json',
  data: new AttachmentData({
    base64: JsonEncoder.toBase64(credReq),
  }),
})

const credentialAttachment = new Attachment({
  id: INDY_CREDENTIAL_ATTACHMENT_ID,
  mimeType: 'application/json',
  data: new AttachmentData({
    base64: JsonEncoder.toBase64({
      values: CredentialUtils.convertAttributesToValues(credentialPreview.attributes),
    }),
  }),
})

const v2CredentialRequest: FormatServiceRequestCredentialFormats = {
  indy: {
    attributes: credentialPreview.attributes,
    credentialDefinitionId: 'Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG',
  },
}

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
let credentialRepository: CredentialRepository
let indyFormatService: CredentialFormatService
let indyLedgerService: IndyLedgerService
let indyIssuerService: IndyIssuerService
let indyHolderService: IndyHolderService
let eventEmitter: EventEmitter
let agentConfig: AgentConfig
let credentialRecord: CredentialExchangeRecord

describe('Indy CredentialFormatService', () => {
  beforeEach(async () => {
    agentConfig = getAgentConfig('CredentialServiceTest')
    eventEmitter = new EventEmitter(agentConfig)

    indyIssuerService = new IndyIssuerServiceMock()
    indyHolderService = new IndyHolderServiceMock()
    indyLedgerService = new IndyLedgerServiceMock()

    indyFormatService = new IndyCredentialFormatService(
      credentialRepository,
      eventEmitter,
      indyIssuerService,
      indyLedgerService,
      indyHolderService,
      agentConfig
    )
    mockFunction(indyLedgerService.getSchema).mockReturnValue(Promise.resolve(schema))
  })

  describe('Create Credential Proposal / Offer', () => {
    let offerOptions: ServiceOfferCredentialOptions
    let proposeOptions: ProposeCredentialOptions

    beforeEach(async () => {
      offerOptions = {
        comment: 'some comment',
        connectionId: connection.id,
        credentialFormats: {
          indy: {
            attributes: credentialPreview.attributes,
            credentialDefinitionId: 'Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG',
          },
        },
        protocolVersion: CredentialProtocolVersion.V2,
      }

      const credPropose = {
        credentialDefinitionId: 'Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG',
        schemaIssuerDid: 'GMm4vMw8LLrLJjp81kRRLp',
        schemaName: 'ahoy',
        schemaVersion: '1.0',
        schemaId: 'q7ATwTYbQDgiigVijUAej:2:test:1.0',
        issuerDid: 'GMm4vMw8LLrLJjp81kRRLp',
      }
      proposeOptions = {
        connectionId: connection.id,
        protocolVersion: CredentialProtocolVersion.V2,
        credentialFormats: {
          indy: {
            payload: credPropose,
            attributes: credentialPreview.attributes,
          },
        },
        comment: 'v2 propose credential format test',
      }
    })

    test(`Creates Credential Proposal`, async () => {
      // when
      const { attachment, preview, format } = await indyFormatService.createProposal(proposeOptions)

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
            'eyJzY2hlbWFfaXNzdWVyX2RpZCI6IkdNbTR2TXc4TExyTEpqcDgxa1JSTHAiLCJzY2hlbWFfaWQiOiJxN0FUd1RZYlFEZ2lpZ1ZpalVBZWo6Mjp0ZXN0OjEuMCIsInNjaGVtYV9uYW1lIjoiYWhveSIsInNjaGVtYV92ZXJzaW9uIjoiMS4wIiwiY3JlZF9kZWZfaWQiOiJUaDdNcFRhUlpWUlluUGlhYmRzODFZOjM6Q0w6MTc6VEFHIiwiaXNzdWVyX2RpZCI6IkdNbTR2TXc4TExyTEpqcDgxa1JSTHAifQ==',
          json: undefined,
          links: undefined,
          jws: undefined,
          sha256: undefined,
        },
      })

      expect(preview).toMatchObject({
        type: 'https://didcomm.org/issue-credential/2.0/credential-preview',
        attributes: [
          {
            mimeType: 'text/plain',
            name: 'name',
            value: 'John',
          },
          {
            mimeType: 'text/plain',
            name: 'age',
            value: '99',
          },
        ],
      })

      expect(format).toMatchObject({
        attachId: expect.any(String),
        format: 'hlindy/cred-filter@v2.0',
      })
    })
    test(`Creates Credential Offer`, async () => {
      // when
      const issuerSpy = jest.spyOn(indyIssuerService, 'createCredentialOffer')
      const { attachment, preview, format } = await indyFormatService.createOffer(offerOptions)

      // then
      expect(issuerSpy).toHaveBeenCalledTimes(1)

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

      expect(preview).toMatchObject({
        type: 'https://didcomm.org/issue-credential/2.0/credential-preview',
        attributes: [
          {
            mimeType: 'text/plain',
            name: 'name',
            value: 'John',
          },
          {
            mimeType: 'text/plain',
            name: 'age',
            value: '99',
          },
        ],
      })

      expect(format).toMatchObject({
        attachId: expect.any(String),
        format: 'hlindy/cred-abstract@v2.0',
      })
    })
  })
  describe('Process Credential Offer', () => {
    beforeEach(async () => {
      credentialRecord = mockCredentialRecord({
        state: CredentialState.OfferReceived,
        threadId: 'fd9c5ddb-ec11-4acd-bc32-540736249746',
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })
    })

    test(`processes credential offer - returns modified credential record (adds metadata)`, async () => {
      // when
      await indyFormatService.processOffer(offerAttachment, credentialRecord)

      const credentialRequestMetadata = credentialRecord.metadata.get(CredentialMetadataKeys.IndyCredential)

      expect(credentialRequestMetadata?.schemaId).toBe('aaa')
      expect(credentialRequestMetadata?.credentialDefinitionId).toBe('Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG')
    })
  })

  describe('Create Credential Request', () => {
    beforeEach(() => {
      credentialRecord = mockCredentialRecord({
        state: CredentialState.OfferReceived,
        threadId: 'fd9c5ddb-ec11-4acd-bc32-540736249746',
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })

      mockFunction(indyLedgerService.getCredentialDefinition).mockReturnValue(Promise.resolve(credDef))
    })

    test('returns credential request message base on existing credential offer message', async () => {
      // given
      const options: ServiceRequestCredentialOptions = {
        connectionId: credentialRecord.connectionId,
        comment: 'credential request comment',
        holderDid: 'holderDid',
        credentialFormats: v2CredentialRequest,
        offerAttachment,
      }
      // when
      const issuerSpy = jest.spyOn(indyHolderService, 'createCredentialRequest')
      const { format, attachment } = await indyFormatService.createRequest(options, credentialRecord)

      // then
      expect(issuerSpy).toHaveBeenCalledTimes(1)

      expect(attachment).toMatchObject({
        id: expect.any(String),
        description: undefined,
        filename: undefined,
        mimeType: 'application/json',
        lastmodTime: undefined,
        byteCount: undefined,
        data: {
          base64:
            'eyJwcm92ZXJfZGlkIjoiaG9sZGVyRGlkIiwiY3JlZF9kZWZfaWQiOiJUTDFFYVBGQ1o4U2k1YVVycVNjQkR0OjM6Q0w6MTY6VEFHIiwiYmxpbmRlZF9tcyI6e30sImJsaW5kZWRfbXNfY29ycmVjdG5lc3NfcHJvb2YiOnt9LCJub25jZSI6Im5vbmNlIn0=',
          json: undefined,
          links: undefined,
          jws: undefined,
          sha256: undefined,
        },
      })
      expect(format).toMatchObject({
        attachId: expect.any(String),
        format: 'hlindy/cred-req@v2.0',
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
        attachId: INDY_CREDENTIAL_ATTACHMENT_ID,
        credentialRecordId: credentialRecord.id,
        comment: 'V2 Indy Credential',
      }
      mockFunction(indyIssuerService.createCredential).mockReturnValue(Promise.resolve([cred, 'x']))
    })

    test('Creates a credential', async () => {
      // given

      // when

      const { format, attachment } = await indyFormatService.createCredential(
        serviceOptions,
        credentialRecord,
        requestAttachment,
        offerAttachment
      )

      expect(attachment).toMatchObject({
        id: 'libindy-cred-0',
        description: undefined,
        filename: undefined,
        mimeType: 'application/json',
        lastmodTime: undefined,
        byteCount: undefined,
        data: {
          base64:
            'eyJzY2hlbWFfaWQiOiJ4c3hzIiwiY3JlZF9kZWZfaWQiOiJ4ZHhkIiwicmV2X3JlZ19pZCI6IngiLCJ2YWx1ZXMiOnsieCI6eyJyYXciOiJ4IiwiZW5jb2RlZCI6InkifX19',
          json: undefined,
          links: undefined,
          jws: undefined,
          sha256: undefined,
        },
      })
      expect(format).toMatchObject({
        attachId: expect.any(String),
        format: 'hlindy/cred-abstract@v2.0',
      })
    })
  })

  describe('Process Credential', () => {
    beforeEach(() => {
      credentialRecord = mockCredentialRecord({
        state: CredentialState.RequestSent,
        metadata: { indyRequest: { cred_req: 'meta-data' } },
      })
      mockFunction(indyLedgerService.getCredentialDefinition).mockReturnValue(Promise.resolve(credDef))
      mockFunction(indyLedgerService.getRevocationRegistryDefinition).mockReturnValue(
        Promise.resolve(revocationTemplate)
      )
      mockFunction(indyHolderService.storeCredential).mockReturnValue(Promise.resolve('100'))
    })

    test('finds credential record by thread ID and saves credential attachment into the wallet', async () => {
      // given
      const issuerSpy = jest.spyOn(indyHolderService, 'storeCredential')

      // when
      await indyFormatService.processCredential({ credentialAttachment }, credentialRecord)

      // then
      expect(issuerSpy).toHaveBeenCalledTimes(1)
      expect(credentialRecord.credentials.length).toBe(1)
      expect(credentialRecord.credentials[0].credentialRecordType).toBe(CredentialFormatType.Indy)
      expect(credentialRecord.credentials[0].credentialRecordId).toBe('100')
    })
  })
})
