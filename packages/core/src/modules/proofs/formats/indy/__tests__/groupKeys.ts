import type { GetProofFormatDataReturn } from '../../../protocol/ProofProtocolOptions'
import type { IndyProofFormat } from '../IndyProofFormat'

import { AriesFrameworkError } from '../../../../../error'

export function getGroupKeysFromIndyProofFormatData(formatData: GetProofFormatDataReturn<[IndyProofFormat]>): {
  proposeKey1: string
  proposeKey2: string
  requestKey1: string
  requestKey2: string
} {
  const proofRequest = formatData.request?.indy
  const proofProposal = formatData.proposal?.indy
  if (!proofProposal) {
    throw new AriesFrameworkError('missing indy proof proposal')
  }
  if (!proofRequest) {
    throw new AriesFrameworkError('missing indy proof request')
  }
  const proposeAttributes = proofProposal.requested_attributes
  const proposePredicates = proofProposal.requested_predicates
  const requestAttributes = proofRequest.requested_attributes
  const requestPredicates = proofRequest.requested_predicates

  const proposeKey1 = Object.keys(proposeAttributes)[1]
  const proposeKey2 = Object.keys(proposePredicates)[0]
  const requestKey1 = Object.keys(requestAttributes)[1]
  const requestKey2 = Object.keys(requestPredicates)[0]

  return { proposeKey1, proposeKey2, requestKey1, requestKey2 }
}
