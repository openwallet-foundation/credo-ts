import type { Logger } from '../../../logger'
import type { FileSystem } from '../../../storage/FileSystem'
import type { RevocationInterval } from '../../credentials/models/RevocationInterval'
import type { RequestedCredentials } from '../../proofs'
import type { default as Indy } from 'indy-sdk'

import { scoped, Lifecycle } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { AriesFrameworkError } from '../../../error/AriesFrameworkError'
import { IndySdkError } from '../../../error/IndySdkError'
import { isIndyError } from '../../../utils/indyError'
import { IndyWallet } from '../../../wallet/IndyWallet'
import { IndyLedgerService } from '../../ledger'

import { IndyUtilitiesService } from './IndyUtilitiesService'

enum RequestReferentType {
  Attribute = 'attribute',
  Predicate = 'predicate',
  SelfAttestedAttribute = 'self-attested-attribute',
}

@scoped(Lifecycle.ContainerScoped)
export class IndyRevocationService {
  private indy: typeof Indy
  private indyUtilitiesService: IndyUtilitiesService
  private fileSystem: FileSystem
  private ledgerService: IndyLedgerService
  private logger: Logger
  private wallet: IndyWallet

  public constructor(
    agentConfig: AgentConfig,
    indyUtilitiesService: IndyUtilitiesService,
    ledgerService: IndyLedgerService,
    wallet: IndyWallet
  ) {
    this.fileSystem = agentConfig.fileSystem
    this.indy = agentConfig.agentDependencies.indy
    this.indyUtilitiesService = indyUtilitiesService
    this.logger = agentConfig.logger
    this.ledgerService = ledgerService
    this.wallet = wallet
  }

  public async createRevocationState(
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

        // If revocation interval is present and the credential is revocable
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

          const revocationRegistryDefinition = await this.ledgerService.getRevocationRegistryDefinition(
            revocationRegistryId
          )

          const { revocRegDelta, deltaTimestamp } = await this.ledgerService.getRevocationRegistryDelta(
            revocationRegistryId,
            requestRevocationInterval?.to,
            0
          )

          const { tailsLocation, tailsHash } = revocationRegistryDefinition.value
          const tails = await this.indyUtilitiesService.downloadTails(tailsHash, tailsLocation)
          
          const revocationState = await this.indy.createRevocationState(
            tails,
            revocationRegistryDefinition,
            revocRegDelta,
            deltaTimestamp,
            credentialRevocationId.toString()
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

  private assertRevocationInterval(requestRevocationInterval: RevocationInterval) {
    // TODO: Add Test
    // Check revocation interval in accordance with https://github.com/hyperledger/aries-rfcs/blob/main/concepts/0441-present-proof-best-practices/README.md#semantics-of-non-revocation-interval-endpoints
    if (requestRevocationInterval.from && requestRevocationInterval.to !== requestRevocationInterval.from) {
      throw new AriesFrameworkError(
        `Presentation requests proof of non-revocation with an interval from: '${requestRevocationInterval.from}' that does not match the interval to: '${requestRevocationInterval.to}', as specified in Aries RFC 0441`
      )
    }
  }

  // Get revocation status for credential (given a from-to)
  // Note from-to interval details: https://github.com/hyperledger/indy-hipe/blob/master/text/0011-cred-revocation/README.md#indy-node-revocation-registry-intervals
  public async getRevocationStatus(
    credentialRevocationId: string,
    revocationRegistryDefinitionId: string,
    requestRevocationInterval: RevocationInterval
  ): Promise<{ revoked: boolean; deltaTimestamp: number }> {
    this.logger.trace(
      `Fetching Credential Revocation Status for Credential Revocation Id '${credentialRevocationId}' with revocation interval with to '${requestRevocationInterval.to}' & from '${requestRevocationInterval.from}'`
    )

    this.assertRevocationInterval(requestRevocationInterval)

    const { revocRegDelta, deltaTimestamp } = await this.ledgerService.getRevocationRegistryDelta(
      revocationRegistryDefinitionId,
      requestRevocationInterval.to,
      requestRevocationInterval.from
    )

    const revoked =
      revocRegDelta.value.revoked && revocRegDelta.value.revoked.includes(parseInt(credentialRevocationId))
    this.logger.trace(
      `Credental with Credential Revocation Id '${credentialRevocationId}' is ${
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
}
