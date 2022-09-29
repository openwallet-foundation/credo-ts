import type { TagsBase } from '../../../storage/BaseRecord'

import { IsEnum, IsString } from 'class-validator'

import { KeyFormat, KeyType } from '../../../crypto'
import { BaseRecord } from '../../../storage/BaseRecord'
import { TypedArrayEncoder } from '../../../utils'

import { Buffer } from './../../../utils/buffer'

export type CustomKeyTags = TagsBase

export type DefaultKeyTags = {
  kid: string
  keyType: string
}

export interface KeyRecordProps {
  kid: string
  controller?: string
  keyType: KeyType
  format: KeyFormat
  privateKey: string
  publicKey: string
}

export class KeyRecord extends BaseRecord<DefaultKeyTags, CustomKeyTags> {
  @IsString()
  public kid!: string

  @IsString()
  public controller?: string

  @IsEnum(KeyType)
  public keyType!: KeyType

  @IsEnum(KeyFormat)
  public format!: KeyFormat

  @IsString()
  public privateKey!: string

  @IsString()
  public publicKey!: string

  public constructor(props: KeyRecordProps) {
    super()

    if (props) {
      this.id = props.kid
      this.kid = props.kid
      this.controller = props.controller
      this.keyType = props.keyType
      this.format = props.format
      this.privateKey = props.privateKey
      this.publicKey = props.publicKey
    }
  }

  public getTags() {
    return {
      ...this._tags,
      kid: this.kid,
      controller: this.controller,
      keyType: this.keyType,
    }
  }

  public get publicKeyBytes(): Buffer {
    return this.keyBytes(this.publicKey)
  }

  public get privateKeyBytes(): Buffer {
    return this.keyBytes(this.privateKey)
  }

  private keyBytes(key: string): Buffer {
    switch (this.format) {
      case KeyFormat.Base58: {
        return TypedArrayEncoder.fromBase58(key)
      }
      case KeyFormat.Base64: {
        return TypedArrayEncoder.fromBase64(key)
      }
      default:
        return Buffer.from([])
    }
  }
}
