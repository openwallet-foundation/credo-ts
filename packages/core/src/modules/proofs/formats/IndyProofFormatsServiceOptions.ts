import type { Attachment } from '../../../decorators/attachment/Attachment'
import { IndyRevocationInterval } from '../../credentials'
import type { GetRequestedCredentialsConfig } from '../models/GetRequestedCredentialsConfig'
import type { RequestProofFormats } from '../models/SharedOptions'
import type { RequestedAttribute, RequestedPredicate } from '../protocol/v1/models'
import type { ProofAttributeInfo } from '../protocol/v1/models/ProofAttributeInfo'
import type { ProofPredicateInfo } from '../protocol/v1/models/ProofPredicateInfo'
import type {
  PresentationPreview,
  PresentationPreviewAttribute,
  PresentationPreviewPredicate,
} from '../protocol/v1/models/V1PresentationPreview'
import type { ProofRequest } from './indy/models/ProofRequest'

export interface IndyProposeProofFormat {
  attributes?: PresentationPreviewAttribute[]
  predicates?: PresentationPreviewPredicate[]
  nonce: string
  name: string
  version: string
}

export interface IndyRequestProofFormat {
  name: string
  version: string
  nonce: string
  nonRevoked?: IndyRevocationInterval
  ver?: '1.0' | '2.0'
  requestedAttributes?: Record<string, ProofAttributeInfo> | Map<string, ProofAttributeInfo>
  requestedPredicates?: Record<string, ProofPredicateInfo> | Map<string, ProofPredicateInfo>
  proofRequest?: ProofRequest
}

export interface IndyVerifyProofFormat {
  proofJson: Attachment
  proofRequest: Attachment
}

export interface IndyPresentationProofFormat {
  requestedAttributes?: Record<string, RequestedAttribute>
  requestedPredicates?: Record<string, RequestedPredicate>
  selfAttestedAttributes?: Record<string, string>
}

export interface GetRequestedCredentialsFormat {
  attachment: Attachment
  presentationProposal?: PresentationPreview
  config?: GetRequestedCredentialsConfig
}

export interface CreateRequestAsResponseOptions {
  id?: string
  formats: RequestProofFormats
}
