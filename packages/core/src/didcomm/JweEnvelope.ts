import type { DidCommV2EncryptionAlgs, DidCommV2KeyProtectionAlgs, DidCommV2Types } from './'

import { Expose, Type } from 'class-transformer'

import { Buffer, JsonEncoder, JsonTransformer, TypedArrayEncoder } from '../utils'

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

export interface ProtectedOptions {
  typ?: string
  enc: string
  alg: string
  skid?: string
  epk?: string
  apu?: string
  apv?: string
}

export class Protected {
  public typ?: string
  public enc!: string
  public alg!: string
  public skid?: string
  public epk?: string
  public apu?: string
  public apv?: string

  public constructor(options: ProtectedOptions) {
    if (options) {
      this.typ = options.typ
      this.enc = options.enc
      this.alg = options.alg
      this.skid = options.skid
      this.epk = options.epk
      this.apu = options.apu
      this.apv = options.apv
    }
  }

  public toJson() {
    return JsonTransformer.toJSON(this)
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

export class JweEnvelopeBuilder {
  public protected!: Protected
  public unprotected?: string

  public ciphertext!: string
  public iv!: string
  public tag!: string
  public header?: string[]
  public encryptedKey?: string
  public recipients!: JweRecipient[]

  public constructor({
    typ,
    alg,
    enc,
  }: {
    typ: DidCommV2Types
    enc: DidCommV2EncryptionAlgs
    alg: DidCommV2KeyProtectionAlgs
  }) {
    this.recipients = []
    this.protected = new Protected({ typ, alg, enc })
  }

  public setRecipient(recipient: JweRecipient): JweEnvelopeBuilder {
    this.recipients.push(recipient)
    return this
  }

  public setCiphertext(ciphertext: Uint8Array | Buffer): JweEnvelopeBuilder {
    this.ciphertext = TypedArrayEncoder.toBase64URL(ciphertext)
    return this
  }

  public setIv(iv: Uint8Array | Buffer): JweEnvelopeBuilder {
    this.iv = TypedArrayEncoder.toBase64URL(iv)
    return this
  }

  public setTag(tag: Uint8Array | Buffer): JweEnvelopeBuilder {
    this.tag = TypedArrayEncoder.toBase64URL(tag)
    return this
  }

  public setProtected(protected_: Protected): JweEnvelopeBuilder {
    this.protected = protected_
    return this
  }

  public setSkid(skid: string): JweEnvelopeBuilder {
    this.protected.skid = skid
    return this
  }

  public setEpk(epk: string): JweEnvelopeBuilder {
    this.protected.epk = epk
    return this
  }

  public setApu(apu: string): JweEnvelopeBuilder {
    this.protected.apu = TypedArrayEncoder.toBase64URL(Buffer.from(apu))
    return this
  }

  public setApv(apv: string[]): JweEnvelopeBuilder {
    this.protected.apv = TypedArrayEncoder.toBase64URL(Buffer.from(apv.sort().join('.')))
    return this
  }

  public apv(): Uint8Array {
    return this.protected.apv ? Uint8Array.from(Buffer.from(this.protected.apv)) : Uint8Array.from([])
  }

  public apu(): Uint8Array {
    return this.protected.apu ? Uint8Array.from(Buffer.from(this.protected.apu)) : Uint8Array.from([])
  }

  public alg(): Uint8Array {
    return Uint8Array.from(Buffer.from(this.protected.alg))
  }

  public aad(): Buffer {
    return Buffer.from(this.protected_())
  }

  private protected_(): string {
    return JsonEncoder.toBase64URL(this.protected.toJson())
  }

  public finalize() {
    return new JweEnvelope({
      ciphertext: this.ciphertext,
      tag: this.tag,
      iv: this.iv,
      protected: this.protected_(),
      recipients: this.recipients,
    })
  }
}
