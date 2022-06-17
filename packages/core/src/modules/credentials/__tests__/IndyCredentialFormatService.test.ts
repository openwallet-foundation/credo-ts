import type { AgentConfig } from '../../../agent/AgentConfig'
import type { Wallet } from '../../../wallet'
import type { ParseRevocationRegistryDefinitionTemplate } from '../../ledger/services/IndyLedgerService'
import type { CredentialFormatService } from '../formats'
import type { IndyCredentialFormat } from '../formats/indy/IndyCredentialFormat'
import type { CredentialPreviewAttribute } from '../models/CredentialPreviewAttribute'
import type { V2OfferCredentialMessageOptions } from '../protocol/v2/messages/V2OfferCredentialMessage'
import type { CustomCredentialTags } from '../repository/CredentialExchangeRecord'
import type { CredentialRepository } from '../repository/CredentialRepository'
import type { RevocRegDef } from 'indy-sdk'

import { getAgentConfig, mockFunction } from '../../../../tests/helpers'
import { EventEmitter } from '../../../agent/EventEmitter'
import { Attachment, AttachmentData } from '../../../decorators/attachment/Attachment'
import { JsonEncoder } from '../../../utils/JsonEncoder'
import { ConnectionService } from '../../connections/services/ConnectionService'
import { DidResolverService } from '../../dids/services/DidResolverService'
import { IndyHolderService } from '../../indy/services/IndyHolderService'
import { IndyIssuerService } from '../../indy/services/IndyIssuerService'
import { IndyLedgerService } from '../../ledger/services/IndyLedgerService'
import { IndyCredentialFormatService } from '../formats'
import { IndyCredentialUtils } from '../formats/indy/IndyCredentialUtils'
import { CredentialState } from '../models'
import {
  INDY_CREDENTIAL_ATTACHMENT_ID,
  INDY_CREDENTIAL_OFFER_ATTACHMENT_ID,
  INDY_CREDENTIAL_REQUEST_ATTACHMENT_ID,
} from '../protocol/v1/messages'
import { V2CredentialPreview } from '../protocol/v2/messages'
import { V2OfferCredentialMessage } from '../protocol/v2/messages/V2OfferCredentialMessage'
import { CredentialMetadataKeys } from '../repository'
import { CredentialExchangeRecord } from '../repository/CredentialExchangeRecord'

import { credDef, credReq, schema } from './fixtures'

jest.mock('../../../modules/ledger/services/IndyLedgerService')
jest.mock('../../indy/services/IndyHolderService')
jest.mock('../../indy/services/IndyIssuerService')
jest.mock('../../dids/services/DidResolverService')
jest.mock('../../connections/services/ConnectionService')

const IndyLedgerServiceMock = IndyLedgerService as jest.Mock<IndyLedgerService>
const IndyHolderServiceMock = IndyHolderService as jest.Mock<IndyHolderService>
const IndyIssuerServiceMock = IndyIssuerService as jest.Mock<IndyIssuerService>
const ConnectionServiceMock = ConnectionService as jest.Mock<ConnectionService>
const DidResolverServiceMock = DidResolverService as jest.Mock<DidResolverService>

const values = {
  x: {
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
      values: IndyCredentialUtils.convertAttributesToValues(credentialPreview.attributes),
    }),
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
  metadata?: { indyRequest: Record<string, unknown> }
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

  if (metadata?.indyRequest) {
    credentialRecord.metadata.set(CredentialMetadataKeys.IndyRequest, { ...metadata.indyRequest })
  }

  return credentialRecord
}
let credentialRepository: CredentialRepository
let indyFormatService: CredentialFormatService<IndyCredentialFormat>
let indyLedgerService: IndyLedgerService
let indyIssuerService: IndyIssuerService
let indyHolderService: IndyHolderService
let didResolverService: DidResolverService
let connectionService: ConnectionService
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
    didResolverService = new DidResolverServiceMock()
    connectionService = new ConnectionServiceMock()
    indyFormatService = new IndyCredentialFormatService(
      credentialRepository,
      eventEmitter,
      indyIssuerService,
      indyLedgerService,
      indyHolderService,
      connectionService,
      didResolverService,
      agentConfig,
      {} as unknown as Wallet
    )

    mockFunction(indyLedgerService.getSchema).mockReturnValue(Promise.resolve(schema))
  })

  describe('Create Credential Proposal / Offer', () => {
    test(`Creates Credential Proposal`, async () => {
      // when
      const { attachment, previewAttributes, format } = await indyFormatService.createProposal({
        credentialRecord: mockCredentialRecord(),
        credentialFormats: {
          indy: {
            credentialDefinitionId: 'Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG',
            schemaIssuerDid: 'GMm4vMw8LLrLJjp81kRRLp',
            schemaName: 'ahoy',
            schemaVersion: '1.0',
            schemaId: 'q7ATwTYbQDgiigVijUAej:2:test:1.0',
            issuerDid: 'GMm4vMw8LLrLJjp81kRRLp',
            attributes: credentialPreview.attributes,
          },
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
            'eyJzY2hlbWFfaXNzdWVyX2RpZCI6IkdNbTR2TXc4TExyTEpqcDgxa1JSTHAiLCJzY2hlbWFfaWQiOiJxN0FUd1RZYlFEZ2lpZ1ZpalVBZWo6Mjp0ZXN0OjEuMCIsInNjaGVtYV9uYW1lIjoiYWhveSIsInNjaGVtYV92ZXJzaW9uIjoiMS4wIiwiY3JlZF9kZWZfaWQiOiJUaDdNcFRhUlpWUlluUGlhYmRzODFZOjM6Q0w6MTc6VEFHIiwiaXNzdWVyX2RpZCI6IkdNbTR2TXc4TExyTEpqcDgxa1JSTHAifQ==',
          json: undefined,
          links: undefined,
          jws: undefined,
          sha256: undefined,
        },
      })

      expect(previewAttributes).toMatchObject([
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
      ])

      expect(format).toMatchObject({
        attachId: expect.any(String),
        format: 'hlindy/cred-filter@v2.0',
      })
    })

    test(`Creates Credential Offer`, async () => {
      // when
      const { attachment, previewAttributes, format } = await indyFormatService.createOffer({
        credentialRecord: mockCredentialRecord(),
        credentialFormats: {
          indy: {
            attributes: credentialPreview.attributes,
            credentialDefinitionId: 'Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG',
          },
        },
      })

      // then
      expect(indyIssuerService.createCredentialOffer).toHaveBeenCalledTimes(1)

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

      expect(previewAttributes).toMatchObject([
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
      ])

      expect(format).toMatchObject({
        attachId: expect.any(String),
        format: 'hlindy/cred-abstract@v2.0',
      })
    })
  })
  describe('Process Credential Offer', () => {
    test(`processes credential offer - returns modified credential record (adds metadata)`, async () => {
      // given
      const credentialRecord = mockCredentialRecord({
        state: CredentialState.OfferReceived,
        threadId: 'fd9c5ddb-ec11-4acd-bc32-540736249746',
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })

      // when
      await indyFormatService.processOffer({ attachment: offerAttachment, credentialRecord })
    })
  })

  describe('Create Credential Request', () => {
    test('returns credential request message base on existing credential offer message', async () => {
      // given
      const credentialRecord = mockCredentialRecord({
        state: CredentialState.OfferReceived,
        threadId: 'fd9c5ddb-ec11-4acd-bc32-540736249746',
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })

      mockFunction(indyLedgerService.getCredentialDefinition).mockReturnValue(Promise.resolve(credDef))

      // when
      const { format, attachment } = await indyFormatService.acceptOffer({
        credentialRecord,
        credentialFormats: {
          indy: {
            holderDid: 'holderDid',
          },
        },
        offerAttachment,
      })

      // then
      expect(indyHolderService.createCredentialRequest).toHaveBeenCalledTimes(1)

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

      const credentialRequestMetadata = credentialRecord.metadata.get(CredentialMetadataKeys.IndyCredential)

      expect(credentialRequestMetadata?.schemaId).toBe('aaa')
      expect(credentialRequestMetadata?.credentialDefinitionId).toBe('Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG')
    })
  })

  describe('Accept request', () => {
    test('Creates a credentials', async () => {
      // given
      const credentialRecord = mockCredentialRecord({
        state: CredentialState.RequestReceived,
        threadId: 'fd9c5ddb-ec11-4acd-bc32-540736249746',
        connectionId: 'b1e2f039-aa39-40be-8643-6ce2797b5190',
      })

      mockFunction(indyIssuerService.createCredential).mockReturnValue(Promise.resolve([cred, 'x']))

      // when
      const { format, attachment } = await indyFormatService.acceptRequest({
        credentialRecord,
        requestAttachment,
        offerAttachment,
        attachId: INDY_CREDENTIAL_ATTACHMENT_ID,
      })

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
        format: 'hlindy/cred@v2.0',
      })
    })
  })

  describe('Process Credential', () => {
    test('finds credential record by thread ID and saves credential attachment into the wallet', async () => {
      // given
      credentialRecord = mockCredentialRecord({
        state: CredentialState.RequestSent,
        metadata: { indyRequest: { cred_req: 'meta-data' } },
      })
      mockFunction(indyLedgerService.getCredentialDefinition).mockReturnValue(Promise.resolve(credDef))
      mockFunction(indyLedgerService.getRevocationRegistryDefinition).mockReturnValue(
        Promise.resolve(revocationTemplate)
      )
      mockFunction(indyHolderService.storeCredential).mockReturnValue(Promise.resolve('100'))

      // when
      await indyFormatService.processCredential({ attachment: credentialAttachment, credentialRecord })

      // then
      expect(indyHolderService.storeCredential).toHaveBeenCalledTimes(1)
      expect(credentialRecord.credentials.length).toBe(1)
      expect(credentialRecord.credentials[0].credentialRecordType).toBe('indy')
      expect(credentialRecord.credentials[0].credentialRecordId).toBe('100')
    })
  })
})
