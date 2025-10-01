import { AgentContext, Key, Buffer } from '@credo-ts/core'
import { Client, PublicKey, Transaction, TransactionReceipt } from '@hashgraph/sdk'
import { Publisher as ClientPublisher } from '@hiero-did-sdk/publisher-internal'
import { hederaPublicKeyFromCredoKey } from '../utils'

export class CredoPublisher extends ClientPublisher {
  private submitPublicKey: PublicKey

  constructor(
    private readonly agentContext: AgentContext,
    client: Client,
    private key: Key
  ) {
    super(client)

    this.submitPublicKey = hederaPublicKeyFromCredoKey(key)
  }

  async setKey(key: Key) {
    this.key = key
    this.submitPublicKey = hederaPublicKeyFromCredoKey(key)
  }

  publicKey(): PublicKey {
    return this.submitPublicKey
  }

  async publish(transaction: Transaction): Promise<TransactionReceipt> {
    const frozenTransaction = transaction.freezeWith(this.client)

    await frozenTransaction.signWith(this.submitPublicKey, (message) => {
      return this.agentContext.wallet.sign({ key: this.key, data: Buffer.from(message) })
    })

    const response = await transaction.execute(this.client)

    return response.getReceipt(this.client)
  }
}
