import type { TagsBase } from '@credo-ts/core'

import { BaseRecord, CredoError, Kms, TypedArrayEncoder, utils } from '@credo-ts/core'

export interface MediatorRoutingRecordProps {
  id?: string
  createdAt?: Date
  routingKeys?: MediatorRoutingRecordRoutingKey[]
  tags?: TagsBase
}

export interface MediatorRoutingRecordRoutingKey {
  /**
   * The routing key fingerprint
   */
  routingKeyFingerprint: string

  /**
   * The key id in the KMS
   */
  kmsKeyId: string
}

export type DefaultMediatorRoutingRecordTags = {
  routingKeyFingerprints: string[]
}

export class MediatorRoutingRecord extends BaseRecord<DefaultMediatorRoutingRecordTags> {
  // TODO: update routing keys here to a did, so we can just point to a did here
  // and reuse all the key management logic we already have in place for dids

  // String values are base58 encoded keys, previously used
  // The array of objects is the new format, including a key id
  public routingKeys!: Array<string | MediatorRoutingRecordRoutingKey>

  public static readonly type = 'MediatorRoutingRecord'
  public readonly type = MediatorRoutingRecord.type

  public constructor(props: MediatorRoutingRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.routingKeys = props.routingKeys || []
    }
  }

  public get routingKeysWithKeyId() {
    return this.routingKeys.map((routingKey) => {
      // routing keys in base58 format use the legacy key id
      if (typeof routingKey === 'string') {
        const publicJwk = Kms.PublicJwk.fromPublicKey({
          kty: 'OKP',
          crv: 'Ed25519',
          publicKey: TypedArrayEncoder.fromBase58(routingKey),
        })
        publicJwk.keyId = publicJwk.legacyKeyId

        return publicJwk
      }

      // routing keys using new structure, have a key id defined
      const publicJwk = Kms.PublicJwk.fromFingerprint(routingKey.routingKeyFingerprint)
      publicJwk.keyId = routingKey.kmsKeyId

      if (!publicJwk.is(Kms.Ed25519PublicJwk)) {
        throw new CredoError('Expected mediator routing record key to be of type Ed25519.')
      }
      return publicJwk
    })
  }

  public getTags() {
    return {
      ...this._tags,
      routingKeyFingerprints: this.routingKeys.map((routingKey) =>
        typeof routingKey === 'string'
          ? Kms.PublicJwk.fromPublicKey({
              kty: 'OKP',
              crv: 'Ed25519',
              publicKey: TypedArrayEncoder.fromBase58(routingKey),
            }).fingerprint
          : routingKey.routingKeyFingerprint
      ),
    }
  }
}
