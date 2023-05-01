import type { Jwk } from '../../../../crypto'

import { Key } from '../../../../crypto/Key'
import { JsonEncoder } from '../../../../utils'
import { parseDid } from '../../domain/parse'

import { getDidJwkDocument } from './didJwkDidDocument'

export class DidJwk {
  public readonly did: string

  private constructor(did: string) {
    this.did = did
  }

  public get forEncrypting() {
    return this.jwk.use === 'enc' || this.key.supportsEncrypting
  }

  public get forSigning() {
    return this.jwk.use === 'sig' || this.key.supportsSigning
  }

  public static fromDid(did: string) {
    // We create a `Key` instance form the jwk, as that validates the jwk
    const parsed = parseDid(did)
    const jwk = JsonEncoder.fromBase64(parsed.id) as Jwk
    Key.fromJwk(jwk)

    return new DidJwk(did)
  }

  public static fromJwk(jwk: Jwk) {
    // We create a `Key` instance form the jwk, as that validates the jwk
    Key.fromJwk(jwk)
    const did = `did:jwk:${JsonEncoder.toBase64URL(jwk)}`

    return new DidJwk(did)
  }

  public get key() {
    return Key.fromJwk(this.jwk)
  }

  public get jwk() {
    const parsed = parseDid(this.did)
    const jwk = JsonEncoder.fromBase64(parsed.id) as Jwk

    return jwk
  }

  public get didDocument() {
    return getDidJwkDocument(this)
  }
}
