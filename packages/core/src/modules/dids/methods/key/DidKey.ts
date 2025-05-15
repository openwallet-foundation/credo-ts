import { PublicJwk } from '../../../kms'
import { getDidDocumentForPublicJwk } from '../../domain/keyDidDocument'
import { parseDid } from '../../domain/parse'

export class DidKey {
  public readonly publicJwk: PublicJwk

  public constructor(publicJwk: PublicJwk) {
    this.publicJwk = publicJwk
  }

  public static fromDid(did: string) {
    const parsed = parseDid(did)

    const publicJwk = PublicJwk.fromFingerprint(parsed.id)
    return new DidKey(publicJwk)
  }

  public get did() {
    return `did:key:${this.publicJwk.fingerprint}`
  }

  public get didDocument() {
    return getDidDocumentForPublicJwk(this.did, this.publicJwk)
  }
}
