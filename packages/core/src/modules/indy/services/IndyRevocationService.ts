import type { Logger } from '../../../logger'
import type { FileSystem } from '../../../storage/FileSystem'
import type { RequestedCredentials } from '../../proofs'
import type { default as Indy, } from 'indy-sdk'

import { scoped, Lifecycle } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { IndySdkError } from '../../../error/IndySdkError'
import { isIndyError } from '../../../utils/indyError'
import { IndyWallet } from '../../../wallet/IndyWallet'
import { IndyLedgerService } from '../../ledger'

import { IndyUtilitiesService } from './IndyUtilitiesService'

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
      const revocationStates: Indy.RevStates = {}
      if (proofRequest.non_revoked) {
        this.logger.debug('Proof request requires proof of non-revocation, creating revocation state(s)')
        //Create array of credential info
        const credentialObjects = [
          ...Object.values(requestedCredentials.requestedAttributes),
          ...Object.values(requestedCredentials.requestedPredicates),
        ]
          .filter((c) => !!c.credentialInfo)
          .map((c) => c.credentialInfo)

        //Cache object to prevent redundancy
        const cachedRevDefinitions: {
          [revRegId: string]: Indy.RevocRegDef
        } = {}

        //Create revocation state of each revocable credential
        for (const requestedCredential of credentialObjects) {
          const revRegId = requestedCredential?.revocationRegistryId
          const credRevId = requestedCredential?.credentialRevocationId
          if (revRegId && credRevId) {
            let revocRegDef: Indy.RevocRegDef

            if (cachedRevDefinitions[revRegId]) {
              revocRegDef = cachedRevDefinitions[revRegId]
            } else {
              revocRegDef = await this.ledgerService.getRevocRegDef(revRegId)
              cachedRevDefinitions[revRegId] = revocRegDef
            }

            const { revocRegDelta, deltaTimestamp } = await this.ledgerService.getRevocRegDelta(
              revRegId,
              proofRequest.non_revoked?.from,
              proofRequest.non_revoked?.to
            )

            const { tailsLocation, tailsHash } = revocRegDef.value
            const tails = await this.indyUtilitiesService.downloadTails(tailsHash, tailsLocation)
            // @ts-ignore TODO: Remove upon DefinitelyTyped types updated
            const revocationState = await this.indy.createRevocationState(
              tails,
              JSON.stringify(revocRegDef),
              JSON.stringify(revocRegDelta),
              deltaTimestamp,
              credRevId.toString()
            )
            revocationStates[revRegId] = { [deltaTimestamp]: revocationState }
          }
        }
      }

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
}
