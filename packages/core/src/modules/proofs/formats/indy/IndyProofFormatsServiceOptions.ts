import type { Attachment } from '../../../../decorators/attachment/Attachment'
import type { IndyRevocationInterval } from '../../../credentials'
import type { ProofExchangeRecord } from '../../repository/ProofExchangeRecord'
import type { ProofAttributeInfo } from '.././indy/models/ProofAttributeInfo'
import type { ProofPredicateInfo } from '.././indy/models/ProofPredicateInfo'

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
  proofJson: Attachment
  proofRequest: Attachment
}

export interface IndyProofRequestFromProposalOptions {
  proofRecord: ProofExchangeRecord
  name?: string
  version?: string
  nonce?: string
}
