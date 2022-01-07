import type { Wallet } from '../../wallet/Wallet'

import { Type } from 'class-transformer'
import { IsString, IsInstance, ValidateNested, IsOptional, ValidateIf, IsArray } from 'class-validator'

import { AriesFrameworkError } from '../../error/AriesFrameworkError'
import { DidKey, KeyType } from '../../modules/dids/domain/DidKey'
import { BufferEncoder } from '../../utils/BufferEncoder'
import { JsonEncoder } from '../../utils/JsonEncoder'
import { base64ToBase64URL } from '../../utils/base64'

const JWS_KEY_TYPE = 'OKP'
const JWS_CURVE = 'Ed25519'
const JWS_ALG = 'EdDSA'

export interface AttachmentJwsHeaderOptions {
  kid: string
}

export class AttachmentJwsHeader {
  @IsString()
  public kid!: string

  public constructor(options: AttachmentJwsHeaderOptions) {
    if (options) {
      this.kid = options.kid
    }
  }
}

export interface AttachmentJwsGeneralOptions {
  header: AttachmentJwsHeader
  signature: string
  protected?: string
}

export class AttachmentJwsGeneral {
  @IsInstance(AttachmentJwsHeader)
  @Type(() => AttachmentJwsHeader)
  @ValidateNested()
  public header!: AttachmentJwsHeader

  @IsString()
  public signature!: string

  @IsString()
  @IsOptional()
  public protected?: string

  public constructor(options: AttachmentJwsGeneralOptions) {
    if (options) {
      this.header = options.header
      this.signature = options.signature
      this.protected = options.protected
    }
  }
}

export interface AttachmentJwsFlattenedOptions {
  signatures: AttachmentJwsGeneral[]
}

export class AttachmentJws {
  @IsInstance(AttachmentJwsHeader)
  @Type(() => AttachmentJwsHeader)
  @ValidateNested()
  @ValidateIf((a: AttachmentJws) => a.signatures === undefined)
  public header?: AttachmentJwsHeader

  @IsString()
  @IsOptional()
  @ValidateIf((a: AttachmentJws) => a.signatures === undefined)
  public protected?: string

  @IsString()
  @ValidateIf((a: AttachmentJws) => a.signatures === undefined)
  public signature?: string

  @IsArray()
  @Type(() => AttachmentJwsGeneral)
  @IsInstance(AttachmentJwsGeneral, { each: true })
  @ValidateNested()
  @ValidateIf((a: AttachmentJws) => a.signature === undefined)
  public signatures?: AttachmentJwsGeneral[]

  public constructor(options: AttachmentJwsFlattenedOptions | AttachmentJwsGeneralOptions) {
    if (options) {
      if ('header' in options) {
        this.header = options.header
        this.protected = options.protected
        this.signature = options.signature
      } else {
        this.signatures = options.signatures
      }
    }
  }
}

function buildProtected(kid: string, verkey: string) {
  return JsonEncoder.toBase64URL({
    alg: JWS_ALG,
    kid,
    jwk: {
      kty: JWS_KEY_TYPE,
      crv: JWS_CURVE,
      x: BufferEncoder.toBase64URL(BufferEncoder.fromBase58(verkey)),
      kid,
    },
  })
}

async function createJws(verkey: string, base64Payload: string, wallet: Wallet) {
  const kid = DidKey.fromPublicKeyBase58(verkey, KeyType.ED25519).did

  const base64Protected = buildProtected(kid, verkey)

  const signature = BufferEncoder.toBase64URL(
    await wallet.sign(BufferEncoder.fromString(`${base64Protected}.${base64Payload}`), verkey)
  )

  return {
    protected: base64Protected,
    signature,
    header: new AttachmentJwsHeader({
      kid,
    }),
  }
}

export async function signAttachmentJws(wallet: Wallet, verkeys: string[], base64: string) {
  // Ensure base64url (attachments are base64)
  const base64Payload = base64ToBase64URL(base64)

  // Flattened JWS format if only a single verkey
  if (verkeys.length === 1) {
    const jws = await createJws(verkeys[0], base64Payload, wallet)

    return new AttachmentJws({
      header: jws.header,
      protected: jws.protected,
      signature: jws.signature,
    })
  }
  // General JWS format if multiple verkeys
  else {
    const signatures: AttachmentJwsGeneral[] = []

    for (const verkey of verkeys) {
      const jws = await createJws(verkey, base64Payload, wallet)

      signatures.push(
        new AttachmentJwsGeneral({
          header: jws.header,
          protected: jws.protected,
          signature: jws.signature,
        })
      )
    }

    return new AttachmentJws({
      signatures,
    })
  }
}

export async function verifyAttachmentJws(wallet: Wallet, jws: AttachmentJws, base64: string) {
  const base64Payload = base64ToBase64URL(base64)

  const signatures = jws.signatures ?? [jws]
  for (const jws of signatures) {
    if (!jws.protected || !jws.signature) {
      throw new AriesFrameworkError('Missing protected and/or signature on JWS')
    }

    const protectedJson = JsonEncoder.fromBase64(jws.protected)

    const isValidKeyType = protectedJson?.jwk?.kty === JWS_KEY_TYPE
    const isValidCurve = protectedJson?.jwk?.crv === JWS_CURVE
    const isValidAlg = protectedJson?.alg === JWS_ALG

    if (!isValidKeyType || !isValidCurve || !isValidAlg) {
      throw new AriesFrameworkError('Invalid protected header')
    }

    const data = BufferEncoder.fromString(`${jws.protected}.${base64Payload}`)
    const signature = BufferEncoder.fromBase64(jws.signature)
    const verkey = BufferEncoder.toBase58(BufferEncoder.fromBase64(protectedJson?.jwk?.x))

    const isValid = await wallet.verify(verkey, data, signature)

    if (!isValid) {
      return false
    }
  }

  return true
}
