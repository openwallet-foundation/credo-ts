import { AgentContext, Kms } from '@credo-ts/core'
import { Client, PublicKey, Transaction, TransactionReceipt } from '@hashgraph/sdk'
import { Publisher as ClientPublisher } from '@hiero-did-sdk/publisher-internal'
import { createOrGetKey, hederaPublicKeyFromPublicJwk } from '../utils'

export class KmsPublisher extends ClientPublisher {
  private readonly kms: Kms.KeyManagementApi

  private keyId: string
  private submitPublicKey: PublicKey

  constructor(agentContext: AgentContext, client: Client, publicJwk: Kms.PublicJwk<Kms.Ed25519PublicJwk>) {
    super(client)

    this.kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)

    this.keyId = publicJwk.keyId
    this.submitPublicKey = hederaPublicKeyFromPublicJwk(publicJwk)
  }

  async setKeyId(keyId: string) {
    const publicJwk = await createOrGetKey(this.kms, keyId)

    this.keyId = keyId
    this.submitPublicKey = hederaPublicKeyFromPublicJwk(publicJwk)
  }

  publicKey(): PublicKey {
    return this.submitPublicKey
  }

  async publish(transaction: Transaction): Promise<TransactionReceipt> {
    const frozenTransaction = transaction.freezeWith(this.client)

    await frozenTransaction.signWith(this.submitPublicKey, async (message) => {
      const signatureResult = await this.kms.sign({ keyId: this.keyId, data: message, algorithm: 'EdDSA' })
      return signatureResult.signature
    })

    const response = await transaction.execute(this.client)

    return response.getReceipt(this.client)
  }
}
