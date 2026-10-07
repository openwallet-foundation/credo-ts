import { CredoError } from '../../../../error'
import { JsonEncoder } from '../../../../utils'
import { PublicJwk } from '../../../kms'
import { parseDid } from '../../domain/parse'
import { getDidJwkDocument } from './didJwkDidDocument'

const privateJwkParameters = ['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth']

function assertPublicJwk(jwk: unknown): asserts jwk is Record<string, unknown> {
  if (!jwk || typeof jwk !== 'object' || Array.isArray(jwk)) {
    throw new CredoError('The did:jwk value must decode to a JWK object')
  }

  if (privateJwkParameters.some((parameter) => parameter in jwk)) {
    throw new CredoError('Private JWK material is not allowed in a did:jwk identifier')
  }
}

export class DidJwk {
  private constructor(
    public readonly did: string,
    public readonly publicJwk: PublicJwk
  ) {}

  public get allowsEncrypting() {
    const use = this.publicJwk.toJson().use
    if (use === 'sig') return false
    if (use === 'enc') return true

    return this.publicJwk.supportedEncryptionKeyAgreementAlgorithms.length > 0
  }

  public get allowsSigning() {
    const use = this.publicJwk.toJson().use
    if (use === 'enc') return false
    if (use === 'sig') return true

    return this.publicJwk.supportedSignatureAlgorithms.length > 0
  }

  public static fromDid(did: string) {
    const parsed = parseDid(did)
    if (parsed.fragment !== undefined && parsed.fragment !== null && parsed.fragment !== '0') {
      throw new CredoError(`Unsupported did:jwk fragment '#${parsed.fragment}'`)
    }

    const jwkJson = JsonEncoder.fromBase64Url(parsed.id)
    assertPublicJwk(jwkJson)

    // Validate the public JWK and remove unsupported or private properties.
    const publicJwk = PublicJwk.fromUnknown(jwkJson)

    return new DidJwk(parsed.did, publicJwk)
  }

  /**
   * A did:jwk DID can only have one verification method, and the verification method
   * id will always be `<did>#0`.
   */
  public get verificationMethodId() {
    return `${this.did}#0`
  }

  public static fromPublicJwk(publicJwk: PublicJwk) {
    const did = `did:jwk:${JsonEncoder.toBase64Url(publicJwk.toJson({ includeKid: false }))}`

    return new DidJwk(did, publicJwk)
  }

  public get jwkJson() {
    return this.publicJwk.toJson()
  }

  public get didDocument() {
    return getDidJwkDocument(this)
  }
}
