import type { Logger } from '../../../logger'

import { inject, Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { InjectionSymbols } from '../../../constants'
import { Wallet } from '../../../wallet/Wallet'
import { ConnectionService } from '../../connections'
import { CredentialRepository } from '../../credentials'
import { IndyHolderService, IndyVerifierService } from '../../indy'
import { IndyLedgerService } from '../../ledger/services/IndyLedgerService'
import { ProofRepository } from '../ProofRepository'

@scoped(Lifecycle.ContainerScoped)
export class V2ProofService {
  private proofRepository: ProofRepository
  private credentialRepository: CredentialRepository
  private ledgerService: IndyLedgerService
  private wallet: Wallet
  private logger: Logger
  private indyHolderService: IndyHolderService
  private indyVerifierService: IndyVerifierService
  private connectionService: ConnectionService
  private eventEmitter: EventEmitter

  public constructor(
    proofRepository: ProofRepository,
    ledgerService: IndyLedgerService,
    @inject(InjectionSymbols.Wallet) wallet: Wallet,
    agentConfig: AgentConfig,
    indyHolderService: IndyHolderService,
    indyVerifierService: IndyVerifierService,
    connectionService: ConnectionService,
    eventEmitter: EventEmitter,
    credentialRepository: CredentialRepository
  ) {
    this.proofRepository = proofRepository
    this.credentialRepository = credentialRepository
    this.ledgerService = ledgerService
    this.wallet = wallet
    this.logger = agentConfig.logger
    this.indyHolderService = indyHolderService
    this.indyVerifierService = indyVerifierService
    this.connectionService = connectionService
    this.eventEmitter = eventEmitter
  }
}
