import { JsonTransformer } from '@aries-framework/core'

import { base64ToBase64URL } from '../../../core/src/utils/base64'

export class JweRecipient {
  public encrypted_key!: string
  public header?: Record<string, string>

  public constructor(options: { encrypted_key: Uint8Array; header?: Record<string, string> }) {
    if (options) {
      this.encrypted_key = base64ToBase64URL(Buffer.from(options.encrypted_key).toString('base64'))
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
  encrypted_key?: string
}

export class JweEnvelope {
  public protected!: string
  public unprotected?: string
  public recipients?: JweRecipient[]
  public ciphertext!: string
  public iv!: string
  public tag!: string
  public aad?: string
  public header?: string[]
  public encrypted_key?: string

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
      this.encrypted_key = options.encrypted_key
    }
  }

  public toJson() {
    return JsonTransformer.toJSON(this)
  }
}
