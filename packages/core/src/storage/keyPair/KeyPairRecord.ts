import type { KeyType } from '../../crypto/KeyType'
import type { TagsBase } from '../BaseRecord'

import { uuid } from '../../utils/uuid'
import { BaseRecord } from '../BaseRecord'

export interface KeyPairRecordProps {
  id?: string
  publicKey: string
  secretKey: string
  keyType: Exclude<KeyType, KeyType.Ed25519 | KeyType.X25519>
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
 */
export class KeyPairRecord extends BaseRecord {
  public publicKey!: string
  public secretKey!: string
  public keyType!: KeyType

  public constructor(props: KeyPairRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.publicKey = props.publicKey
      this.secretKey = props.secretKey
      this.keyType = props.keyType
    }
  }

  /**
   * @todo which tags should be returned here?
   *       publicKey and keyType?
   */
  public getTags(): TagsBase {
    return this._tags
  }
}
