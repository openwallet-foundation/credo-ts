import type { DidDocument } from './domain'

export interface DidDocumentKey {
  /**
   * The key id of the key in the kms associated with the
   */
  kmsKeyId: string

  /**
   * The key id
   */
  didDocumentRelativeKeyId: string
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
   * List of keys associated with the did document, that are managed by the kms of this agent.
   *
   * NOTE: if no keys are provided, it is not possible to sign or encrypt with keys in the imported
   * did document.
   */
  keys?: DidDocumentKey[]

  /**
   * Whether to overwrite an existing did record if it exists. If set to false,
   * an error will be thrown if the did record already exists.
   *
   * @default false
   */
  overwrite?: boolean
}
