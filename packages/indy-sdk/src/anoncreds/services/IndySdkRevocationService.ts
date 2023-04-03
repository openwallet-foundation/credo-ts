import type {
  AnonCredsRevocationRegistryDefinition,
  AnonCredsRevocationStatusList,
  AnonCredsProofRequest,
  AnonCredsSelectedCredentials,
  AnonCredsCredentialInfo,
  AnonCredsNonRevokedInterval,
} from '@aries-framework/anoncreds'
import type { AgentContext } from '@aries-framework/core'
import type { RevStates } from 'indy-sdk'

import { assertBestPracticeRevocationInterval } from '@aries-framework/anoncreds'
import { AriesFrameworkError, inject, injectable } from '@aries-framework/core'

import { IndySdkError, isIndyError } from '../../error'
import { IndySdk, IndySdkSymbol } from '../../types'
import { createTailsReader } from '../utils/tails'
import {
  indySdkRevocationDeltaFromAnonCreds,
  indySdkRevocationRegistryDefinitionFromAnonCreds,
} from '../utils/transform'

enum RequestReferentType {
  Attribute = 'attribute',
  Predicate = 'predicate',
  SelfAttestedAttribute = 'self-attested-attribute',
}

/**
 * Internal class that handles revocation related logic for the Indy SDK
 *
 * @internal
 */
@injectable()
export class IndySdkRevocationService {
  private indySdk: IndySdk

  public constructor(@inject(IndySdkSymbol) indySdk: IndySdk) {
    this.indySdk = indySdk
  }

  /**
   * Creates the revocation state for the requested credentials in a format that the Indy SDK expects.
   */
  public async createRevocationState(
    agentContext: AgentContext,
    proofRequest: AnonCredsProofRequest,
    selectedCredentials: AnonCredsSelectedCredentials,
    revocationRegistries: {
      [revocationRegistryDefinitionId: string]: {
        // Tails is already downloaded
        tailsFilePath: string
        definition: AnonCredsRevocationRegistryDefinition
        revocationStatusLists: {
          [timestamp: string]: AnonCredsRevocationStatusList
        }
      }
    }
  ): Promise<RevStates> {
    try {
      agentContext.config.logger.debug(`Creating Revocation State(s) for proof request`, {
        proofRequest,
        selectedCredentials,
      })
      const indyRevocationStates: RevStates = {}
      const referentCredentials: Array<{
        type: RequestReferentType
        referent: string
        credentialInfo: AnonCredsCredentialInfo
        referentRevocationInterval: AnonCredsNonRevokedInterval | undefined
        timestamp: number | undefined
      }> = []

      //Retrieve information for referents and push to single array
      for (const [referent, selectedCredential] of Object.entries(selectedCredentials.attributes ?? {})) {
        referentCredentials.push({
          referent,
          credentialInfo: selectedCredential.credentialInfo,
          type: RequestReferentType.Attribute,
          referentRevocationInterval: proofRequest.requested_attributes[referent].non_revoked,
          timestamp: selectedCredential.timestamp,
        })
      }
      for (const [referent, selectedCredential] of Object.entries(selectedCredentials.predicates ?? {})) {
        referentCredentials.push({
          referent,
          credentialInfo: selectedCredential.credentialInfo,
          type: RequestReferentType.Predicate,
          referentRevocationInterval: proofRequest.requested_predicates[referent].non_revoked,
          timestamp: selectedCredential.timestamp,
        })
      }

      for (const { referent, credentialInfo, type, referentRevocationInterval, timestamp } of referentCredentials) {
        // Prefer referent-specific revocation interval over global revocation interval
        const requestRevocationInterval = referentRevocationInterval ?? proofRequest.non_revoked
        const credentialRevocationId = credentialInfo.credentialRevocationId
        const revocationRegistryId = credentialInfo.revocationRegistryId

        // If revocation interval is present and the credential is revocable then create revocation state
        if (requestRevocationInterval && timestamp && credentialRevocationId && revocationRegistryId) {
          agentContext.config.logger.trace(
            `Presentation is requesting proof of non revocation for ${type} referent '${referent}', creating revocation state for credential`,
            {
              requestRevocationInterval,
              credentialRevocationId,
              revocationRegistryId,
            }
          )

          assertBestPracticeRevocationInterval(requestRevocationInterval)

          const { definition, revocationStatusLists, tailsFilePath } = revocationRegistries[revocationRegistryId]

          // Extract revocation status list for the given timestamp
          const revocationStatusList = revocationStatusLists[timestamp]
          if (!revocationStatusList) {
            throw new AriesFrameworkError(
              `Revocation status list for revocation registry ${revocationRegistryId} and timestamp ${timestamp} not found in revocation status lists. All revocation status lists must be present.`
            )
          }

          const tails = await createTailsReader(agentContext, tailsFilePath)

          const revocationState = await this.indySdk.createRevocationState(
            tails,
            indySdkRevocationRegistryDefinitionFromAnonCreds(revocationRegistryId, definition),
            indySdkRevocationDeltaFromAnonCreds(revocationStatusList),
            revocationStatusList.timestamp,
            credentialRevocationId
          )

          if (!indyRevocationStates[revocationRegistryId]) {
            indyRevocationStates[revocationRegistryId] = {}
          }
          indyRevocationStates[revocationRegistryId][timestamp] = revocationState
        }
      }

      agentContext.config.logger.debug(`Created Revocation States for Proof Request`, {
        indyRevocationStates,
      })

      return indyRevocationStates
    } catch (error) {
      agentContext.config.logger.error(`Error creating Indy Revocation State for Proof Request`, {
        error,
        proofRequest,
        selectedCredentials,
      })

      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }
}
