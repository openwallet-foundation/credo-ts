export interface LdKeyPairOptions {
  id: string
  controller: string
  revoked?: string
}

export abstract class LdKeyPair {
  public readonly id: string
  public readonly controller: string
  public readonly revoked?: string
  public abstract type: string

  public constructor(options: LdKeyPairOptions) {
    this.id = options.id
    this.controller = options.controller
    this.revoked = options.revoked
  }

  public static async generate(): Promise<LdKeyPair> {
    throw new Error('Not implemented')
  }

  public static async from(verificationMethod: Record<string, any>): Promise<LdKeyPair> {
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
      revoked: this.revoked ?? undefined,
    }
    if (this.revoked) {
      key.revoked = this.revoked
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
