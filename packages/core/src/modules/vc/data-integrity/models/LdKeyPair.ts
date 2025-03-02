import type { VerificationMethod } from '../../../dids'

export interface LdKeyPairOptions {
  id: string
  controller: string
}

export abstract class LdKeyPair {
  public readonly id: string
  public readonly controller: string
  public abstract type: string

  public constructor(options: LdKeyPairOptions) {
    this.id = options.id
    this.controller = options.controller
  }

  public static async generate(): Promise<LdKeyPair> {
    throw new Error('Not implemented')
  }

  public static async from(_verificationMethod: VerificationMethod): Promise<LdKeyPair> {
    throw new Error('Abstract method from() must be implemented in subclass.')
  }

  public export(publicKey = false, privateKey = false) {
    if (!publicKey && !privateKey) {
      throw new Error('Export requires specifying either "publicKey" or "privateKey".')
    }
    const key = {
      id: this.id,
      type: this.type,
      controller: this.controller,
    }

    return key
  }

  public abstract fingerprint(): string

  public abstract verifyFingerprint(fingerprint: string): boolean

  public abstract signer(): {
    sign: (data: { data: Uint8Array | Uint8Array[] }) => Promise<Uint8Array | Array<Uint8Array>>
  }

  public abstract verifier(): {
    verify: (data: { data: Uint8Array | Uint8Array[]; signature: Uint8Array }) => Promise<boolean>
  }
}
