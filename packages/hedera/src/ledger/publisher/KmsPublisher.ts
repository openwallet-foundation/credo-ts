import { AgentContext, Kms, TypedArrayEncoder } from '@credo-ts/core'
import { Client, PublicKey, Transaction, TransactionReceipt } from '@hashgraph/sdk'
import { KeysUtility } from '@hiero-did-sdk/core'
import { Publisher as ClientPublisher } from '@hiero-did-sdk/publisher-internal'
import { createOrGetKey } from '../utils'

export class KmsPublisher extends ClientPublisher {
  private readonly kms: Kms.KeyManagementApi

  private keyId: string
  private submitPublicKey: PublicKey

  constructor(
    agentContext: AgentContext,
    client: Client,
    key: { keyId: string; publicJwk: Kms.KmsJwkPublicOkp & { crv: 'Ed25519' } }
  ) {
    super(client)

    this.kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)

    this.keyId = key.keyId
    this.submitPublicKey = KeysUtility.fromBytes(
      Uint8Array.from(TypedArrayEncoder.fromBase64(key.publicJwk.x))
    ).toPublicKey()
  }

  async setKeyId(keyId: string) {
    const { publicJwk } = await createOrGetKey(this.kms, keyId)

    this.keyId = keyId
    this.submitPublicKey = KeysUtility.fromBytes(
      Uint8Array.from(TypedArrayEncoder.fromBase64(publicJwk.x))
    ).toPublicKey()
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
