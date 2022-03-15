import type { KeyType } from '../../crypto/KeyType'
import type { TagsBase } from '../BaseRecord'

import { BufferEncoder } from '../../utils'
import { uuid } from '../../utils/uuid'
import { BaseRecord } from '../BaseRecord'

export type KeyPairKeyTypes = Exclude<KeyType, KeyType.Ed25519 | KeyType.X25519>

interface KeyPairRecordProps {
  id?: string
  publicKey: Uint8Array
  privateKey: Uint8Array
  keyType: KeyPairKeyTypes
}

/**
 * Standard storage record for key pairs
 *
 * Used for storing the following keyTypes:
 * - Bls12381g1
 * - Bls12381g2
 * - Bls12381g1g2
 *
 * Ed25519 and X25519 are handled via the indy-sdk
 *
 */
export class KeyPairRecord extends BaseRecord {
  /**
   * Base58 encoded public key
   */
  public publicKeyBase58!: string

  /**
   * Base58 encoded secretKey
   */
  public privateKeyBase58!: string

  /**
   * Key type of the keypair
   */
  public keyType!: KeyType

  public constructor(props: KeyPairRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.publicKeyBase58 = BufferEncoder.toBase58(props.publicKey)
      this.privateKeyBase58 = BufferEncoder.toBase58(props.privateKey)
      this.keyType = props.keyType
    }
  }

  /**
   * @returns the tags of record, this includes the default tags, the publicKeyBase58 and the keyType
   */
  public getTags(): TagsBase {
    return { ...this._tags, publicKeyBase58: this.publicKeyBase58, keyType: this.keyType }
  }
}
