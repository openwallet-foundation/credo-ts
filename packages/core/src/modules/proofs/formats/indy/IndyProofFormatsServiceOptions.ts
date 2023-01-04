import type { V1Attachment } from '../../../../decorators/attachment/V1Attachment'
import type { IndyRevocationInterval } from '../../../credentials'
import type { GetRequestedCredentialsConfig } from '../../models/GetRequestedCredentialsConfig'
import type { PresentationPreview } from '../../protocol/v1/models/V1PresentationPreview'
import type { ProofExchangeRecord } from '../../repository/ProofExchangeRecord'
import type { ProofAttributeInfo } from '.././indy/models/ProofAttributeInfo'
import type { ProofPredicateInfo } from '.././indy/models/ProofPredicateInfo'
import type { IndyRequestedCredentialsFormat } from './IndyProofFormat'

export type IndyPresentationProofFormat = IndyRequestedCredentialsFormat

export interface IndyRequestProofFormat {
  name?: string
  version?: string
  nonce?: string
  nonRevoked?: IndyRevocationInterval
  ver?: '1.0' | '2.0'
  requestedAttributes?: Record<string, ProofAttributeInfo> | Map<string, ProofAttributeInfo>
  requestedPredicates?: Record<string, ProofPredicateInfo> | Map<string, ProofPredicateInfo>
}

export interface IndyVerifyProofFormat {
  proofJson: V1Attachment
  proofRequest: V1Attachment
}

export interface GetRequestedCredentialsFormat {
  attachment: V1Attachment
  presentationProposal?: PresentationPreview
  config?: GetRequestedCredentialsConfig
}

export interface IndyProofRequestFromProposalOptions {
  proofRecord: ProofExchangeRecord
  name?: string
  version?: string
  nonce?: string
}
