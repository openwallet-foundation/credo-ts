import type { KeyType } from '../../crypto'
import type { Buffer } from '../../utils'
import type { DidDocument } from './domain'

interface PrivateKey {
  keyType: KeyType
  privateKey: Buffer
}

export interface ImportDidOptions {
  /**
   * The did to import.
   */
  did: string

  /**
   * Optional did document to import. If not provided, the did document will be resolved using the did resolver.
   */
  didDocument?: DidDocument

  /**
   * List of private keys associated with the did document that should be stored in the wallet.
   */
  privateKeys?: PrivateKey[]

  /**
   * Whether to overwrite an existing did record if it exists. If set to false,
   * an error will be thrown if the did record already exists.
   *
   * @default false
   */
  overwrite?: boolean
}
