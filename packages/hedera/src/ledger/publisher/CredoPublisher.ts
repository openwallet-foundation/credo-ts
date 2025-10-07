import type { AgentContext, Key } from '@credo-ts/core'
import type { Client, PublicKey, Transaction, TransactionReceipt } from '@hashgraph/sdk'

import { Buffer } from '@credo-ts/core'
import { Publisher as ClientPublisher } from '@hiero-did-sdk/publisher-internal'

import { hederaPublicKeyFromCredoKey } from '../utils'

export class CredoPublisher extends ClientPublisher {
  private submitPublicKey: PublicKey

  public constructor(private readonly agentContext: AgentContext, client: Client, private key: Key) {
    super(client)

    this.submitPublicKey = hederaPublicKeyFromCredoKey(key)
  }

  public async setKey(key: Key) {
    this.key = key
    this.submitPublicKey = hederaPublicKeyFromCredoKey(key)
  }

  public publicKey(): PublicKey {
    return this.submitPublicKey
  }

  public async publish(transaction: Transaction): Promise<TransactionReceipt> {
    const frozenTransaction = transaction.freezeWith(this.client)

    await frozenTransaction.signWith(this.submitPublicKey, (message) => {
      return this.agentContext.wallet.sign({ key: this.key, data: Buffer.from(message) })
    })

    const response = await transaction.execute(this.client)

    return response.getReceipt(this.client)
  }
}
