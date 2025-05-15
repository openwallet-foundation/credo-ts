import { AgentContext, Kms } from '@credo-ts/core'
import type { IndyVdrRequest, RequestResponseType, IndyVdrPool as indyVdrPool } from '@hyperledger/indy-vdr-shared'

import { parseIndyDid } from '@credo-ts/anoncreds'
import { TypedArrayEncoder } from '@credo-ts/core'
import {
  GetAcceptanceMechanismsRequest,
  GetTransactionAuthorAgreementRequest,
  PoolCreate,
  indyVdr,
} from '@hyperledger/indy-vdr-shared'

import { IndyVdrError } from '../error'

export interface TransactionAuthorAgreement {
  version?: `${number}.${number}` | `${number}`
  acceptanceMechanism: string
}

export interface AuthorAgreement {
  digest: string
  version: string
  text: string
  ratification_ts: number
  acceptanceMechanisms: AcceptanceMechanisms
}

export interface AcceptanceMechanisms {
  aml: Record<string, string>
  amlContext: string
  version: string
}

export interface IndyVdrPoolConfig {
  genesisTransactions: string
  isProduction: boolean
  indyNamespace: string
  transactionAuthorAgreement?: TransactionAuthorAgreement
  connectOnStartup?: boolean
}

export class IndyVdrPool {
  private _pool?: indyVdrPool
  private poolConfig: IndyVdrPoolConfig
  public authorAgreement?: AuthorAgreement | null

  public constructor(poolConfig: IndyVdrPoolConfig) {
    this.poolConfig = poolConfig
  }

  public get indyNamespace(): string {
    return this.poolConfig.indyNamespace
  }

  public get config() {
    return this.poolConfig
  }

  public get isOpen() {
    return this._pool !== undefined
  }

  public connect() {
    if (this._pool) {
      return
    }

    this._pool = new PoolCreate({
      parameters: {
        transactions: this.config.genesisTransactions,
      },
    })
  }

  /**
   * Refreshes the connection to the pool.
   */
  public async refreshConnection(): Promise<void> {
    if (this._pool) {
      await this._pool.refresh()
    }
  }

  /**
   * Get the transactions for a pool
   */
  public get transactions() {
    return this.pool.transactions
  }

  private get pool(): indyVdrPool {
    if (!this._pool) this.connect()
    if (!this._pool) throw new IndyVdrError('Pool is not connected.')

    return this._pool
  }

  public close() {
    if (!this._pool) {
      throw new IndyVdrError("Can't close pool. Pool is not connected")
    }

    // FIXME: Currently, the close method is not working correctly in the indy-vdr-shared package
    // this.pool.close()
  }

  public async prepareWriteRequest<Request extends IndyVdrRequest>(
    agentContext: AgentContext,
    request: Request,
    signingKey: Kms.PublicJwk<Kms.Ed25519PublicJwk>,
    endorserDid?: string
  ) {
    const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
    await this.appendTaa(request)

    if (endorserDid) {
      request.setEndorser({ endorser: parseIndyDid(endorserDid).namespaceIdentifier })
    }

    const { signature } = await kms.sign({
      data: TypedArrayEncoder.fromString(request.signatureInput),
      algorithm: 'EdDSA',
      keyId: signingKey.keyId,
    })

    request.setSignature({
      signature,
    })

    return request
  }

  /**
   * This method submits a request to the ledger.
   * It does only submit the request. It does not modify it in any way.
   * To create the request, use the `prepareWriteRequest` method.
   * @param writeRequest
   */

  public async submitRequest<Request extends IndyVdrRequest>(
    writeRequest: Request
  ): Promise<RequestResponseType<Request>> {
    return await this.pool.submitRequest(writeRequest)
  }

  private async appendTaa(request: IndyVdrRequest) {
    const authorAgreement = await this.getTransactionAuthorAgreement()
    const poolTaa = this.config.transactionAuthorAgreement

    // If ledger does not have TAA, we can just send request
    if (authorAgreement == null) {
      return request
    }

    // Ledger has taa but user has not specified which one to use
    if (!poolTaa) {
      throw new IndyVdrError(
        `Please, specify a transaction author agreement with version and acceptance mechanism. ${JSON.stringify(
          authorAgreement
        )}`
      )
    }

    // Throw an error if the pool doesn't have the specified version and acceptance mechanism
    if (
      authorAgreement.version !== poolTaa.version ||
      !authorAgreement.acceptanceMechanisms.aml[poolTaa.acceptanceMechanism]
    ) {
      // Throw an error with a helpful message
      const errMessage = `Unable to satisfy matching TAA with mechanism ${JSON.stringify(
        poolTaa.acceptanceMechanism
      )} and version ${poolTaa.version} in pool.\n Found ${JSON.stringify(
        authorAgreement.acceptanceMechanisms.aml
      )} and version ${authorAgreement.version} in pool.`
      throw new IndyVdrError(errMessage)
    }

    const acceptance = indyVdr.prepareTxnAuthorAgreementAcceptance({
      text: authorAgreement.text,
      version: authorAgreement.version,
      taaDigest: authorAgreement.digest,
      time: Math.floor(new Date().getTime() / 1000),
      acceptanceMechanismType: poolTaa.acceptanceMechanism,
    })

    request.setTransactionAuthorAgreementAcceptance({
      acceptance: JSON.parse(acceptance),
    })
  }

  private async getTransactionAuthorAgreement(): Promise<AuthorAgreement | null> {
    // TODO Replace this condition with memoization
    if (this.authorAgreement !== undefined) {
      return this.authorAgreement
    }

    const taaRequest = new GetTransactionAuthorAgreementRequest({})
    const taaResponse = await this.submitRequest(taaRequest)

    const acceptanceMechanismRequest = new GetAcceptanceMechanismsRequest({})
    const acceptanceMechanismResponse = await this.submitRequest(acceptanceMechanismRequest)

    const taaData = taaResponse.result.data

    // TAA can be null
    if (taaData == null) {
      this.authorAgreement = null
      return null
    }

    // If TAA is not null, we can be sure AcceptanceMechanisms is also not null
    const authorAgreement = taaData as Omit<AuthorAgreement, 'acceptanceMechanisms'>

    const acceptanceMechanisms = acceptanceMechanismResponse.result.data as AcceptanceMechanisms
    this.authorAgreement = {
      ...authorAgreement,
      acceptanceMechanisms,
    }

    return this.authorAgreement
  }
}
