import type { PublicKey } from '../publicKey/PublicKey'

import { Transform } from 'class-transformer'
import { IsString } from 'class-validator'

import { Authentication } from './Authentication'

export class ReferencedAuthentication extends Authentication {
  public constructor(publicKey: PublicKey, type: string) {
    super()

    this.publicKey = publicKey
    this.type = type
  }

  @IsString()
  public type!: string

  @Transform(({ value }: { value: PublicKey }) => value.id, {
    toPlainOnly: true,
  })
  public publicKey!: PublicKey
}
