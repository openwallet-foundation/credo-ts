import type { AgentContext } from '../../../agent'
import type { IndyRevocationInterval } from '../../credentials'
import type { RequestedCredentials } from '../../proofs/formats/indy/models/RequestedCredentials'
import type { default as Indy } from 'indy-sdk'

import { AgentDependencies } from '../../../agent/AgentDependencies'
import { InjectionSymbols } from '../../../constants'
import { AriesFrameworkError } from '../../../error/AriesFrameworkError'
import { IndySdkError } from '../../../error/IndySdkError'
import { Logger } from '../../../logger'
import { injectable, inject } from '../../../plugins'
import { isIndyError } from '../../../utils/indyError'
import { IndyLedgerService } from '../../ledger'

import { IndyUtilitiesService } from './IndyUtilitiesService'

enum RequestReferentType {
  Attribute = 'attribute',
  Predicate = 'predicate',
  SelfAttestedAttribute = 'self-attested-attribute',
}
@injectable()
export class IndyRevocationService {
  private indy: typeof Indy
  private indyUtilitiesService: IndyUtilitiesService
  private ledgerService: IndyLedgerService
  private logger: Logger

  public constructor(
    indyUtilitiesService: IndyUtilitiesService,
    ledgerService: IndyLedgerService,
    @inject(InjectionSymbols.AgentDependencies) agentDependencies: AgentDependencies,
    @inject(InjectionSymbols.Logger) logger: Logger
  ) {
    this.indy = agentDependencies.indy
    this.indyUtilitiesService = indyUtilitiesService
    this.logger = logger
    this.ledgerService = ledgerService
  }

  public async createRevocationState(
    agentContext: AgentContext,
    proofRequest: Indy.IndyProofRequest,
    requestedCredentials: RequestedCredentials
  ): Promise<Indy.RevStates> {
    try {
      this.logger.debug(`Creating Revocation State(s) for proof request`, {
        proofRequest,
        requestedCredentials,
      })
      const revocationStates: Indy.RevStates = {}
      const referentCredentials = []

      //Retrieve information for referents and push to single array
      for (const [referent, requestedCredential] of Object.entries(requestedCredentials.requestedAttributes)) {
        referentCredentials.push({
          referent,
          credentialInfo: requestedCredential.credentialInfo,
          type: RequestReferentType.Attribute,
        })
      }
      for (const [referent, requestedCredential] of Object.entries(requestedCredentials.requestedPredicates)) {
        referentCredentials.push({
          referent,
          credentialInfo: requestedCredential.credentialInfo,
          type: RequestReferentType.Predicate,
        })
      }

      for (const { referent, credentialInfo, type } of referentCredentials) {
        if (!credentialInfo) {
          throw new AriesFrameworkError(
            `Credential for referent '${referent} does not have credential info for revocation state creation`
          )
        }

        // Prefer referent-specific revocation interval over global revocation interval
        const referentRevocationInterval =
          type === RequestReferentType.Predicate
            ? proofRequest.requested_predicates[referent].non_revoked
            : proofRequest.requested_attributes[referent].non_revoked
        const requestRevocationInterval = referentRevocationInterval ?? proofRequest.non_revoked
        const credentialRevocationId = credentialInfo.credentialRevocationId
        const revocationRegistryId = credentialInfo.revocationRegistryId

        // If revocation interval is present and the credential is revocable then create revocation state
        if (requestRevocationInterval && credentialRevocationId && revocationRegistryId) {
          this.logger.trace(
            `Presentation is requesting proof of non revocation for ${type} referent '${referent}', creating revocation state for credential`,
            {
              requestRevocationInterval,
              credentialRevocationId,
              revocationRegistryId,
            }
          )

          this.assertRevocationInterval(requestRevocationInterval)

          const { revocationRegistryDefinition } = await this.ledgerService.getRevocationRegistryDefinition(
            agentContext,
            revocationRegistryId
          )

          const { revocationRegistryDelta, deltaTimestamp } = await this.ledgerService.getRevocationRegistryDelta(
            agentContext,
            revocationRegistryId,
            requestRevocationInterval?.to,
            0
          )

          const { tailsLocation, tailsHash } = revocationRegistryDefinition.value
          const tails = await this.indyUtilitiesService.downloadTails(tailsHash, tailsLocation)

          const revocationState = await this.indy.createRevocationState(
            tails,
            revocationRegistryDefinition,
            revocationRegistryDelta,
            deltaTimestamp,
            credentialRevocationId
          )
          const timestamp = revocationState.timestamp

          if (!revocationStates[revocationRegistryId]) {
            revocationStates[revocationRegistryId] = {}
          }
          revocationStates[revocationRegistryId][timestamp] = revocationState
        }
      }

      this.logger.debug(`Created Revocation States for Proof Request`, {
        revocationStates,
      })

      return revocationStates
    } catch (error) {
      this.logger.error(`Error creating Indy Revocation State for Proof Request`, {
        error,
        proofRequest,
        requestedCredentials,
      })

      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  // Get revocation status for credential (given a from-to)
  // Note from-to interval details: https://github.com/hyperledger/indy-hipe/blob/master/text/0011-cred-revocation/README.md#indy-node-revocation-registry-intervals
  public async getRevocationStatus(
    agentContext: AgentContext,
    credentialRevocationId: string,
    revocationRegistryDefinitionId: string,
    requestRevocationInterval: IndyRevocationInterval
  ): Promise<{ revoked: boolean; deltaTimestamp: number }> {
    this.logger.trace(
      `Fetching Credential Revocation Status for Credential Revocation Id '${credentialRevocationId}' with revocation interval with to '${requestRevocationInterval.to}' & from '${requestRevocationInterval.from}'`
    )

    this.assertRevocationInterval(requestRevocationInterval)

    const { revocationRegistryDelta, deltaTimestamp } = await this.ledgerService.getRevocationRegistryDelta(
      agentContext,
      revocationRegistryDefinitionId,
      requestRevocationInterval.to,
      0
    )

    const revoked: boolean = revocationRegistryDelta.value.revoked?.includes(parseInt(credentialRevocationId)) || false
    this.logger.trace(
      `Credential with Credential Revocation Id '${credentialRevocationId}' is ${
        revoked ? '' : 'not '
      }revoked with revocation interval with to '${requestRevocationInterval.to}' & from '${
        requestRevocationInterval.from
      }'`
    )

    return {
      revoked,
      deltaTimestamp,
    }
  }

  // TODO: Add Test
  // Check revocation interval in accordance with https://github.com/hyperledger/aries-rfcs/blob/main/concepts/0441-present-proof-best-practices/README.md#semantics-of-non-revocation-interval-endpoints
  private assertRevocationInterval(requestRevocationInterval: IndyRevocationInterval) {
    if (!requestRevocationInterval.to) {
      throw new AriesFrameworkError(`Presentation requests proof of non-revocation with no 'to' value specified`)
    }

    if (
      (requestRevocationInterval.from || requestRevocationInterval.from === 0) &&
      requestRevocationInterval.to !== requestRevocationInterval.from
    ) {
      throw new AriesFrameworkError(
        `Presentation requests proof of non-revocation with an interval from: '${requestRevocationInterval.from}' that does not match the interval to: '${requestRevocationInterval.to}', as specified in Aries RFC 0441`
      )
    }
  }
}
