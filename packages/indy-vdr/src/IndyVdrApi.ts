import type { Kms } from '@credo-ts/core'
import type { IndyVdrRequest } from '@hyperledger/indy-vdr-shared'

import { parseIndyDid } from '@credo-ts/anoncreds'
import { AgentContext, injectable } from '@credo-ts/core'
import { CustomRequest } from '@hyperledger/indy-vdr-shared'

import { verificationPublicJwkForIndyDid } from './dids/didIndyUtil'
import { IndyVdrError } from './error'
import { IndyVdrPoolService } from './pool'
import { multiSignRequest, signRequest } from './utils/sign'

@injectable()
export class IndyVdrApi {
  private agentContext: AgentContext
  private indyVdrPoolService: IndyVdrPoolService

  public constructor(agentContext: AgentContext, indyVdrPoolService: IndyVdrPoolService) {
    this.agentContext = agentContext
    this.indyVdrPoolService = indyVdrPoolService
  }

  private async multiSignRequest<Request extends IndyVdrRequest>(
    request: Request,
    signingKey: Kms.PublicJwk<Kms.Ed25519PublicJwk>,
    identifier: string
  ) {
    return multiSignRequest(this.agentContext, request, signingKey, identifier)
  }

  private async signRequest<Request extends IndyVdrRequest>(request: Request, submitterDid: string) {
    const { pool } = await this.indyVdrPoolService.getPoolForDid(this.agentContext, submitterDid)
    return signRequest(this.agentContext, pool, request, submitterDid)
  }

  /**
   * This method refreshes the pool connection and ensures the pool is up to date with the ledger.
   */
  public refreshPoolConnections() {
    return this.indyVdrPoolService.refreshPoolConnections()
  }

  /**
   * This method gets the updated transactions of the pool.
   * @returns The transactions of the pool ledger
   */
  public getAllPoolTransactions() {
    return this.indyVdrPoolService.getAllPoolTransactions()
  }

  /**
   * This method endorses a transaction. The transaction can be either a string or a JSON object.
   * If the transaction has a signature, it means the transaction was created by another author and will be endorsed.
   * This requires the `endorser` on the transaction to be equal to the unqualified variant of the `endorserDid`.
   *
   * If the transaction is not signed, we have a special case where the endorser will author the transaction.
   * This is required when a new did is created, as the author and the endorser did must already exist on the ledger.
   * In this case, the author did (`identifier`) must be equal to the unqualified identifier of the `endorserDid`.
   * @param transaction the transaction body to be endorsed
   * @param endorserDid the did of the endorser
   * @returns An endorsed transaction
   */
  public async endorseTransaction(transaction: string | Record<string, unknown>, endorserDid: string) {
    const endorserSigningKey = await verificationPublicJwkForIndyDid(this.agentContext, endorserDid)
    const { namespaceIdentifier } = parseIndyDid(endorserDid)

    const request = new CustomRequest({ customRequest: transaction })
    let endorsedTransaction: CustomRequest

    // the request is not parsed correctly due to too large numbers. The reqId overflows.
    const txBody = typeof transaction === 'string' ? JSON.parse(transaction) : transaction
    if (txBody.signature) {
      if (txBody.endorser !== namespaceIdentifier) throw new IndyVdrError('Submitter does not match Endorser')
      endorsedTransaction = await this.multiSignRequest(request, endorserSigningKey, namespaceIdentifier)
    } else {
      if (txBody.identifier !== namespaceIdentifier) throw new IndyVdrError('Submitter does not match identifier')
      endorsedTransaction = await this.signRequest(request, endorserDid)
    }
    return endorsedTransaction.body
  }
}
