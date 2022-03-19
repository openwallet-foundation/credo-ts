import type { Buffer } from '../utils/buffer'
import type { JsonLdDocument } from 'jsonld'

export abstract class KeyPair {
  abstract sign(message: Buffer): Promise<Buffer>

  abstract verify(message: Buffer, signature: Buffer): Promise<boolean>

  abstract get hasPublicKey(): boolean

  abstract get publicKey(): Buffer | undefined

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abstract fromVerificationMethod(verificationMethod: Record<string, any>): KeyPair
}

export interface KeyPairReworkOptions {
  id: string
  controller: string
  revoked: string
}

// K-TODO Rename to LDKeyClass
export abstract class LDKeyClass {
  public readonly id: string
  public readonly controller: string
  public readonly revoked: string

  public constructor(options: KeyPairReworkOptions) {
    this.id = options.id
    this.controller = options.controller
    this.revoked = options.revoked
  }

  public static async generate(): Promise<KeyPairRework> {
    throw new Error('Not implemented')
  }

  // public static async fromKeyDocument(options: {
  //   document: JsonLdDocument
  //   checkContext?: boolean
  //   checkRevoked?: boolean
  // }): Promise<KeyPairRework> {
  //   if (!options.checkContext) options.checkContext = true
  //   if (!options.checkRevoked) options.checkRevoked = true

  //   if (options.checkContext) {
  //     const fetchedDocContexts = [].concat(options.document['@context'])
  //     if (!fetchedDocContexts.includes(this.SUITE_CONTEXT)) {
  //       throw new Error('Key document does not contain required context "' + this.SUITE_CONTEXT + '".')
  //     }
  //   }
  //   if (options.checkRevoked && options.document.revoked) {
  //     throw new Error(`Key has been revoked since: "${document.revoked}".`)
  //   }
  //   return this.from(document)
  // }

  public static async from() {
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
    sign: (data: Uint8Array | Array<Uint8Array>) => Promise<Uint8Array | Array<Uint8Array>>
  }

  public abstract verifier(): {
    verify: (data: Uint8Array | Array<Uint8Array>, signature: Uint8Array) => Promise<boolean>
  }
}
