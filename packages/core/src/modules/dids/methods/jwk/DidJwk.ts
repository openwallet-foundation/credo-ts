import { JsonEncoder } from '../../../../utils'
import { PublicJwk } from '../../../kms'
import { parseDid } from '../../domain/parse'

import { getDidJwkDocument } from './didJwkDidDocument'

export class DidJwk {
  private constructor(
    public readonly did: string,
    public readonly publicJwk: PublicJwk
  ) {}

  public get allowsEncrypting() {
    return this.publicJwk.toJson().use === 'enc' || this.publicJwk.supportedEncryptionKeyAgreementAlgorithms.length > 0
  }

  public get allowsSigning() {
    return this.publicJwk.toJson().use === 'sig' || this.publicJwk.supportedSignatureAlgorithms.length > 0
  }

  public static fromDid(did: string) {
    const parsed = parseDid(did)
    const jwkJson = JsonEncoder.fromBase64(parsed.id)

    // This validates the jwk
    const publicJwk = PublicJwk.fromUnknown(jwkJson)

    return new DidJwk(did, publicJwk)
  }

  /**
   * A did:jwk DID can only have one verification method, and the verification method
   * id will always be `<did>#0`.
   */
  public get verificationMethodId() {
    return `${this.did}#0`
  }

  public static fromPublicJwk(publicJwk: PublicJwk) {
    const did = `did:jwk:${JsonEncoder.toBase64URL(publicJwk.toJson({ includeKid: false }))}`

    return new DidJwk(did, publicJwk)
  }

  public get jwkJson() {
    return this.publicJwk.toJson()
  }

  public get didDocument() {
    return getDidJwkDocument(this)
  }
}
