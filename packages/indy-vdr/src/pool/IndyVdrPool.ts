import type { Logger, AgentContext, Key } from '@aries-framework/core'
import type { IndyVdrRequest, IndyVdrPool as indyVdrPool } from 'indy-vdr-test-shared'

import { TypedArrayEncoder } from '@aries-framework/core'
import {
  GetTransactionAuthorAgreementRequest,
  GetAcceptanceMechanismsRequest,
  PoolCreate,
  indyVdr,
} from 'indy-vdr-test-shared'

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
}

export class IndyVdrPool {
  private _pool?: indyVdrPool
  private logger: Logger
  private poolConfig: IndyVdrPoolConfig
  public authorAgreement?: AuthorAgreement | null

  public constructor(poolConfig: IndyVdrPoolConfig, logger: Logger) {
    this.logger = logger
    this.poolConfig = poolConfig
  }

  public get indyNamespace(): string {
    return this.poolConfig.indyNamespace
  }

  public get config() {
    return this.poolConfig
  }

  public async connect() {
    this._pool = new PoolCreate({
      parameters: {
        transactions: this.config.genesisTransactions,
      },
    })

    return this.pool.handle
  }

  private get pool(): indyVdrPool {
    if (!this._pool) {
      throw new IndyVdrError('Pool is not connected. Make sure to call .connect() first')
    }

    return this._pool
  }

  public close() {
    if (!this.pool) {
      throw new IndyVdrError("Can't close pool. Pool is not connected")
    }

    // FIXME: this method doesn't work??
    // this.pool.close()
  }

  public async submitWriteRequest<Request extends IndyVdrRequest>(
    agentContext: AgentContext,
    request: Request,
    signingKey: Key
  ) {
    await this.appendTaa(request)

    const signature = await agentContext.wallet.sign({
      data: TypedArrayEncoder.fromString(request.signatureInput),
      key: signingKey,
    })

    request.setSignature({
      signature,
    })

    return await this.pool.submitRequest(request)
  }

  public async submitReadRequest<Request extends IndyVdrRequest>(request: Request) {
    return await this.pool.submitRequest(request)
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

    request.setTransactionAuthorAgreementAcceptance({ acceptance })
  }

  private async getTransactionAuthorAgreement(): Promise<AuthorAgreement | null> {
    // TODO Replace this condition with memoization
    if (this.authorAgreement !== undefined) {
      return this.authorAgreement
    }

    const taaRequest = new GetTransactionAuthorAgreementRequest({})
    const taaResponse = await this.submitReadRequest(taaRequest)

    const acceptanceMechanismRequest = new GetAcceptanceMechanismsRequest({})
    const acceptanceMechanismResponse = await this.submitReadRequest(acceptanceMechanismRequest)

    const taaData = taaResponse.result.data

    // TAA can be null
    if (taaData == null) {
      this.authorAgreement = null
      return null
    }

    // If TAA is not null, we can be sure AcceptanceMechanisms is also not null
    const authorAgreement = taaData as Omit<AuthorAgreement, 'acceptanceMechanisms'>

    // FIME: remove cast when https://github.com/hyperledger/indy-vdr/pull/142 is released
    const acceptanceMechanisms = acceptanceMechanismResponse.result.data as unknown as AcceptanceMechanisms  
    this.authorAgreement = {
      ...authorAgreement,
      acceptanceMechanisms,
    }

    return this.authorAgreement
  }
}
