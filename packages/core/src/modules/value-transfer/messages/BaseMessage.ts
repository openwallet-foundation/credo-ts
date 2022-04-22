import { PartyProof, Payment, Signature } from '@value-transfer/value-transfer-lib'
import { Expose, Type } from 'class-transformer'
import { IsArray, IsInstance, IsNumber, IsOptional, IsString, validate, ValidateNested } from 'class-validator'
import { randomUUID } from 'crypto'

export type BaseCommonMessageParams = {
  from: string
  to?: string | Array<string>
  thid?: string
  pthid?: string
}

export type BaseMessageParams = {
  from: string
  to?: string | Array<string>
  body: ValueTransferBody
  thid?: string
  pthid?: string
}

export class BaseMessage implements SigningMessage {
  @Expose({ name: 'id' })
  @IsString()
  public readonly id!: string

  @Expose({ name: 'type' })
  @IsString()
  public readonly type!: string

  @Expose({ name: 'from' })
  @IsString()
  public from!: string

  @Expose({ name: 'to' })
  @IsArray()
  @IsOptional()
  public to?: string[]

  @IsNumber()
  @IsOptional()
  public created_time?: number

  @IsNumber()
  @IsOptional()
  public expires_time?: number

  @Expose({ name: 'body' })
  @Type(() => ValueTransferBody)
  @ValidateNested()
  @IsInstance(ValueTransferBody)
  public body!: ValueTransferBody

  @IsString()
  @IsOptional()
  public thid?: string

  @IsString()
  @IsOptional()
  public pthid?: string

  public constructor({ from, to, thid, pthid, body }: BaseMessageParams) {
    this.id = randomUUID()
    this.from = from
    this.body = body
    this.created_time = new Date().getTime()
    this.thid = thid
    this.pthid = pthid
    if (to) {
      if (Array.isArray(to)) {
        this.to = to
      } else {
        this.to = [to]
      }
    }
  }

  public signer(): string {
    return this.from
  }

  public signingPayload(): ValueTransferBody | Payment {
    return this.body.payment
  }

  public signature(): Signature {
    if (!this.body.signatures) {
      throw new ValueTransferError(ErrorCodes.MissingSignature)
    }
    return this.body.signatures[0]
  }

  public signatures(): Signature[] {
    return this.body.signatures
  }

  public addSignature(signature: string) {
    this.body.signatures.push(
      new Signature({
        party: this.from,
        signature,
      })
    )
  }

  public proof() {
    if (!this.body.proofs) {
      throw new ValueTransferError(ErrorCodes.MissingProof)
    }
    return this.body.proofs[0]
  }

  public async verifyTimeout() {
    if (!this.body.payment.timeout) {
      return
    }

    const endTimeMilliSeconds = this.body.payment.createdAt + this.body.payment.timeout * 1000
    const nowMilliSeconds = Date.now()

    if (nowMilliSeconds >= endTimeMilliSeconds) {
      throw new ValueTransferError(ErrorCodes.TimeoutReached)
    }
  }

  async validate() {
    const validationErrors = await validate(this)
    if (validationErrors.length > 0) {
      throw new ValueTransferError(ErrorCodes.MalformedBody)
    }
  }
}
