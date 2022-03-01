import type { CustomCredentialTags, CredentialPreviewAttribute, RequestCredentialMessage } from '@aries-framework/core'
import type { IndyCredentialMetadata } from '@aries-framework/core/build/types'

import { checkProofRequestForDuplicates } from '..'
import { Attachment, AttachmentData } from '../../decorators/attachment/Attachment'

import {
  CredentialMetadataKeys,
  AriesFrameworkError,
  AttributeFilter,
  PredicateType,
  ProofAttributeInfo,
  ProofPredicateInfo,
  ProofRequest,
  CredentialState,
  OfferCredentialMessage,
  CredentialRecord,
  CredentialPreview,
} from '@aries-framework/core'

export const INDY_CREDENTIAL_OFFER_ATTACHMENT_ID = 'libindy-cred-offer-0'

const credentialPreview = CredentialPreview.fromRecord({
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

const mockCredentialRecord = ({
  state,
  requestMessage,
  metadata,
  threadId,
  connectionId,
  tags,
  id,
  credentialAttributes,
}: {
  state?: CredentialState
  requestMessage?: RequestCredentialMessage
  metadata?: IndyCredentialMetadata & { indyRequest: Record<string, unknown> }
  tags?: CustomCredentialTags
  threadId?: string
  connectionId?: string
  id?: string
  credentialAttributes?: CredentialPreviewAttribute[]
} = {}) => {
  const offerMessage = new OfferCredentialMessage({
    comment: 'some comment',
    credentialPreview: credentialPreview,
    offerAttachments: [offerAttachment],
  })

  const credentialRecord = new CredentialRecord({
    offerMessage,
    id,
    credentialAttributes: credentialAttributes || credentialPreview.attributes,
    requestMessage,
    state: state || CredentialState.OfferSent,
    threadId: threadId ?? offerMessage.id,
    connectionId: connectionId ?? '123',
    tags,
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

describe('Present Proof', () => {
  let secCredDef: CredentialRecord
  let credDef: CredentialRecord

  beforeAll(async () => {
    credDef = mockCredentialRecord({ state: CredentialState.OfferSent })
    secCredDef = mockCredentialRecord({ state: CredentialState.OfferSent })
  })

  test('attribute names match, same cred def filter', async () => {
    const attributes = {
      name: new ProofAttributeInfo({
        name: 'age',
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: credDef.id,
          }),
        ],
      }),
      age: new ProofAttributeInfo({
        name: 'age',
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: credDef.id,
          }),
        ],
      }),
    }

    const nonce = 'testtesttest12345'

    const proofRequest = new ProofRequest({
      name: 'proof-request',
      version: '1.0',
      nonce,
      requestedAttributes: attributes,
    })

    expect(() => checkProofRequestForDuplicates(proofRequest)).toThrowError(AriesFrameworkError)
  })

  test('attribute names match with predicates name, same cred def filter', async () => {
    const attributes = {
      name: new ProofAttributeInfo({
        name: 'age',
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: credDef.id,
          }),
        ],
      }),
    }

    const predicates = {
      age: new ProofPredicateInfo({
        name: 'age',
        predicateType: PredicateType.GreaterThanOrEqualTo,
        predicateValue: 50,
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: credDef.id,
          }),
        ],
      }),
    }

    const nonce = 'testtesttest12345'

    const proofRequest = new ProofRequest({
      name: 'proof-request',
      version: '1.0',
      nonce,
      requestedAttributes: attributes,
      requestedPredicates: predicates,
    })

    expect(() => checkProofRequestForDuplicates(proofRequest)).toThrowError(AriesFrameworkError)
  })

  test('attribute names match, different cred def filter', async () => {
    const attributes = {
      name: new ProofAttributeInfo({
        name: 'age',
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: credDef.id,
          }),
        ],
      }),
      age: new ProofAttributeInfo({
        name: 'age',
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: secCredDef.id,
          }),
        ],
      }),
    }

    const nonce = 'testtesttest12345'

    const proofRequest = new ProofRequest({
      name: 'proof-request',
      version: '1.0',
      nonce,
      requestedAttributes: attributes,
    })

    expect(() => checkProofRequestForDuplicates(proofRequest)).toThrowError(AriesFrameworkError)
  })

  test('attribute name matches with predicate name, different cred def filter', async () => {
    const attributes = {
      name: new ProofAttributeInfo({
        name: 'age',
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: credDef.id,
          }),
        ],
      }),
    }

    const predicates = {
      age: new ProofPredicateInfo({
        name: 'age',
        predicateType: PredicateType.GreaterThanOrEqualTo,
        predicateValue: 50,
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: secCredDef.id,
          }),
        ],
      }),
    }

    const nonce = 'testtesttest12345'

    const proofRequest = new ProofRequest({
      name: 'proof-request',
      version: '1.0',
      nonce,
      requestedAttributes: attributes,
      requestedPredicates: predicates,
    })

    expect(() => checkProofRequestForDuplicates(proofRequest)).toThrowError(AriesFrameworkError)
  })
})
