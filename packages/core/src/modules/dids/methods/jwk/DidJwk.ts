import type { Jwk } from '../../../../crypto'

import { getJwkFromJson } from '../../../../crypto/jose/jwk'
import { JsonEncoder } from '../../../../utils'
import { parseDid } from '../../domain/parse'

import { getDidJwkDocument } from './didJwkDidDocument'

export class DidJwk {
  public readonly did: string

  private constructor(did: string) {
    this.did = did
  }

  public get allowsEncrypting() {
    return this.jwk.use === 'enc' || this.key.supportsEncrypting
  }

  public get allowsSigning() {
    return this.jwk.use === 'sig' || this.key.supportsSigning
  }

  public static fromDid(did: string) {
    const parsed = parseDid(did)
    const jwkJson = JsonEncoder.fromBase64(parsed.id)
    // This validates the jwk
    getJwkFromJson(jwkJson)

    return new DidJwk(did)
  }

  /**
   * A did:jwk DID can only have one verification method, and the verification method
   * id will always be `<did>#0`.
   */
  public get verificationMethodId() {
    return `${this.did}#0`
  }

  public static fromJwk(jwk: Jwk) {
    const did = `did:jwk:${JsonEncoder.toBase64URL(jwk.toJson())}`

    return new DidJwk(did)
  }

  public get key() {
    return this.jwk.key
  }

  public get jwk() {
    const jwk = getJwkFromJson(this.jwkJson)

    return jwk
  }

  public get jwkJson() {
    const parsed = parseDid(this.did)
    const jwkJson = JsonEncoder.fromBase64(parsed.id)

    return jwkJson
  }

  public get didDocument() {
    return getDidJwkDocument(this)
  }
}
