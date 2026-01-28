import type { AgentContext } from '@credo-ts/core'
import type { AnonCredsCredentialsForProofRequest, AnonCredsGetCredentialsForProofRequestOptions } from '../formats'
import type {
  AnonCredsCredentialInfo,
  AnonCredsProofRequest,
  AnonCredsRequestedAttribute,
  AnonCredsRequestedAttributeMatch,
  AnonCredsRequestedPredicate,
  AnonCredsRequestedPredicateMatch,
} from '../models'
import type { AnonCredsHolderService, GetCredentialsForProofRequestReturn } from '../services'

import { AnonCredsHolderServiceSymbol } from '../services'

import { fetchRevocationStatusList } from './anonCredsObjects'
import { assertBestPracticeRevocationInterval } from './revocationInterval'
import { sortRequestedCredentialsMatches } from './sortRequestedCredentialsMatches'
import { dateToTimestamp } from './timestamp'

const getCredentialsForProofRequestReferent = async (
  agentContext: AgentContext,
  proofRequest: AnonCredsProofRequest,
  attributeReferent: string
): Promise<GetCredentialsForProofRequestReturn> => {
  const holderService = agentContext.dependencyManager.resolve<AnonCredsHolderService>(AnonCredsHolderServiceSymbol)

  const credentials = await holderService.getCredentialsForProofRequest(agentContext, {
    proofRequest,
    attributeReferent,
  })

  return credentials
}

const getRevocationStatus = async (
  agentContext: AgentContext,
  proofRequest: AnonCredsProofRequest,
  requestedItem: AnonCredsRequestedAttribute | AnonCredsRequestedPredicate,
  credentialInfo: AnonCredsCredentialInfo
) => {
  const requestNonRevoked = requestedItem.non_revoked ?? proofRequest.non_revoked
  const credentialRevocationId = credentialInfo.credentialRevocationId
  const revocationRegistryId = credentialInfo.revocationRegistryId

  // If revocation interval is not present or the credential is not revocable then we
  // don't need to fetch the revocation status
  if (!requestNonRevoked || credentialRevocationId === null || !revocationRegistryId) {
    return { isRevoked: undefined, timestamp: undefined }
  }

  agentContext.config.logger.trace(
    `Fetching credential revocation status for credential revocation id '${credentialRevocationId}' with revocation interval with from '${requestNonRevoked.from}' and to '${requestNonRevoked.to}'`
  )

  // Make sure the revocation interval follows best practices from Aries RFC 0441
  assertBestPracticeRevocationInterval(requestNonRevoked)

  const { revocationStatusList } = await fetchRevocationStatusList(
    agentContext,
    revocationRegistryId,
    requestNonRevoked.to ?? dateToTimestamp(new Date())
  )

  const isRevoked = revocationStatusList.revocationList[Number.parseInt(credentialRevocationId, 10)] === 1

  agentContext.config.logger.trace(
    `Credential with credential revocation index '${credentialRevocationId}' is ${
      isRevoked ? '' : 'not '
    }revoked with revocation interval with to '${requestNonRevoked.to}' & from '${requestNonRevoked.from}'`
  )

  return {
    isRevoked,
    timestamp: revocationStatusList.timestamp,
  }
}

export const getCredentialsForAnonCredsProofRequest = async (
  agentContext: AgentContext,
  proofRequest: AnonCredsProofRequest,
  options: AnonCredsGetCredentialsForProofRequestOptions
): Promise<AnonCredsCredentialsForProofRequest> => {
  const credentialsForProofRequest: AnonCredsCredentialsForProofRequest = {
    attributes: {},
    predicates: {},
  }

  for (const [referent, requestedAttribute] of Object.entries(proofRequest.requested_attributes)) {
    const credentials = await getCredentialsForProofRequestReferent(agentContext, proofRequest, referent)

    credentialsForProofRequest.attributes[referent] = sortRequestedCredentialsMatches(
      await Promise.all(
        credentials.map(async (credential) => {
          const { isRevoked, timestamp } = await getRevocationStatus(
            agentContext,
            proofRequest,
            requestedAttribute,
            credential.credentialInfo
          )

          return {
            credentialId: credential.credentialInfo.credentialId,
            revealed: true,
            credentialInfo: credential.credentialInfo,
            timestamp,
            revoked: isRevoked,
          } satisfies AnonCredsRequestedAttributeMatch
        })
      )
    )

    // We only attach revoked state if non-revocation is requested. So if revoked is true it means
    // the credential is not applicable to the proof request
    if (options.filterByNonRevocationRequirements) {
      credentialsForProofRequest.attributes[referent] = credentialsForProofRequest.attributes[referent].filter(
        (r) => !r.revoked
      )
    }
  }

  for (const [referent, requestedPredicate] of Object.entries(proofRequest.requested_predicates)) {
    const credentials = await getCredentialsForProofRequestReferent(agentContext, proofRequest, referent)

    credentialsForProofRequest.predicates[referent] = sortRequestedCredentialsMatches(
      await Promise.all(
        credentials.map(async (credential) => {
          const { isRevoked, timestamp } = await getRevocationStatus(
            agentContext,
            proofRequest,
            requestedPredicate,
            credential.credentialInfo
          )

          return {
            credentialId: credential.credentialInfo.credentialId,
            credentialInfo: credential.credentialInfo,
            timestamp,
            revoked: isRevoked,
          } satisfies AnonCredsRequestedPredicateMatch
        })
      )
    )

    // We only attach revoked state if non-revocation is requested. So if revoked is true it means
    // the credential is not applicable to the proof request
    if (options.filterByNonRevocationRequirements) {
      credentialsForProofRequest.predicates[referent] = credentialsForProofRequest.predicates[referent].filter(
        (r) => !r.revoked
      )
    }
  }

  return credentialsForProofRequest
}
