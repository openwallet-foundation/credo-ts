import { JsonTransformer, TypedArrayEncoder } from '@aries-framework/core'
import { Expose, Type } from 'class-transformer'

export class JweRecipient {
  @Expose({ name: 'encrypted_key' })
  public encryptedKey!: string
  public header?: Record<string, string>

  public constructor(options: { encryptedKey: Uint8Array; header?: Record<string, string> }) {
    if (options) {
      this.encryptedKey = TypedArrayEncoder.toBase64URL(options.encryptedKey)

      this.header = options.header
    }
  }
}

export interface JweEnvelopeOptions {
  protected: string
  unprotected?: string
  recipients?: JweRecipient[]
  ciphertext: string
  iv: string
  tag: string
  aad?: string
  header?: string[]
  encryptedKey?: string
}

export class JweEnvelope {
  public protected!: string
  public unprotected?: string

  @Type(() => JweRecipient)
  public recipients?: JweRecipient[]
  public ciphertext!: string
  public iv!: string
  public tag!: string
  public aad?: string
  public header?: string[]

  @Expose({ name: 'encrypted_key' })
  public encryptedKey?: string

  public constructor(options: JweEnvelopeOptions) {
    if (options) {
      this.protected = options.protected
      this.unprotected = options.unprotected
      this.recipients = options.recipients
      this.ciphertext = options.ciphertext
      this.iv = options.iv
      this.tag = options.tag
      this.aad = options.aad
      this.header = options.header
      this.encryptedKey = options.encryptedKey
    }
  }

  public toJson() {
    return JsonTransformer.toJSON(this)
  }
}
