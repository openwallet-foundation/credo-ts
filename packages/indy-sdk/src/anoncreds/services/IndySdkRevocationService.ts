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
      }> = []

      //Retrieve information for referents and push to single array
      for (const [referent, selectedCredential] of Object.entries(selectedCredentials.attributes ?? {})) {
        referentCredentials.push({
          referent,
          credentialInfo: selectedCredential.credentialInfo,
          type: RequestReferentType.Attribute,
          referentRevocationInterval: proofRequest.requested_attributes[referent].non_revoked,
        })
      }
      for (const [referent, selectedCredential] of Object.entries(selectedCredentials.predicates ?? {})) {
        referentCredentials.push({
          referent,
          credentialInfo: selectedCredential.credentialInfo,
          type: RequestReferentType.Predicate,
          referentRevocationInterval: proofRequest.requested_predicates[referent].non_revoked,
        })
      }

      for (const { referent, credentialInfo, type, referentRevocationInterval } of referentCredentials) {
        // Prefer referent-specific revocation interval over global revocation interval
        const requestRevocationInterval = referentRevocationInterval ?? proofRequest.non_revoked
        const credentialRevocationId = credentialInfo.credentialRevocationId
        const revocationRegistryId = credentialInfo.revocationRegistryId

        // If revocation interval is present and the credential is revocable then create revocation state
        if (requestRevocationInterval && credentialRevocationId && revocationRegistryId) {
          agentContext.config.logger.trace(
            `Presentation is requesting proof of non revocation for ${type} referent '${referent}', creating revocation state for credential`,
            {
              requestRevocationInterval,
              credentialRevocationId,
              revocationRegistryId,
            }
          )

          this.assertRevocationInterval(requestRevocationInterval)

          const { definition, revocationStatusLists, tailsFilePath } = revocationRegistries[revocationRegistryId]
          // NOTE: we assume that the revocationStatusLists have been added based on timestamps of the `to` query. On a higher level it means we'll find the
          // most accurate revocation list for a given timestamp. It doesn't have to be that the revocationStatusList is from the `to` timestamp however.
          const revocationStatusList = revocationStatusLists[requestRevocationInterval.to]

          const tails = await createTailsReader(agentContext, tailsFilePath)

          const revocationState = await this.indySdk.createRevocationState(
            tails,
            indySdkRevocationRegistryDefinitionFromAnonCreds(revocationRegistryId, definition),
            indySdkRevocationDeltaFromAnonCreds(revocationStatusList),
            revocationStatusList.timestamp,
            credentialRevocationId
          )
          const timestamp = revocationState.timestamp

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

  // TODO: Add Test
  // TODO: we should do this verification on a higher level I think?
  // Check revocation interval in accordance with https://github.com/hyperledger/aries-rfcs/blob/main/concepts/0441-present-proof-best-practices/README.md#semantics-of-non-revocation-interval-endpoints
  private assertRevocationInterval(
    revocationInterval: AnonCredsNonRevokedInterval
  ): asserts revocationInterval is BestPracticeNonRevokedInterval {
    if (!revocationInterval.to) {
      throw new AriesFrameworkError(`Presentation requests proof of non-revocation with no 'to' value specified`)
    }

    if (
      (revocationInterval.from || revocationInterval.from === 0) &&
      revocationInterval.to !== revocationInterval.from
    ) {
      throw new AriesFrameworkError(
        `Presentation requests proof of non-revocation with an interval from: '${revocationInterval.from}' that does not match the interval to: '${revocationInterval.to}', as specified in Aries RFC 0441`
      )
    }
  }
}

// This sets the `to` value to be required. We do this check in the `assertRevocationInterval` method,
// and it makes it easier to work with the object in TS
interface BestPracticeNonRevokedInterval {
  from?: number
  to: number
}
