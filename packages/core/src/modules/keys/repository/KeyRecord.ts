import type { TagsBase } from '../../../storage/BaseRecord'

import assert from 'assert'
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

export type JWKKeyRepresentation = {
  JWK: Record<string, unknown>
}

export type MultibaseKeyRepresentation = {
  Multibase: string
}

export type Base58KeyRepresentation = {
  Base58: string
}

export type Base64KeyRepresentation = {
  Base64: string
}

export type HexKeyRepresentation = {
  Hex: string
}

export type PemKeyRepresentation = {
  Pem: string
}

export type BlockchainAccountId = {
  BlockchainAccountId: string
}

export type EthereumAddress = {
  EthereumAddress: string
}

export type KeyRepresentation =
  | JWKKeyRepresentation
  | MultibaseKeyRepresentation
  | Base58KeyRepresentation
  | Base64KeyRepresentation
  | HexKeyRepresentation
  | PemKeyRepresentation
  | BlockchainAccountId
  | EthereumAddress

export interface KeyRecordProps {
  kid: string
  controller?: string
  keyType: KeyType
  format: KeyFormat
  privateKey: KeyRepresentation
  publicKey: KeyRepresentation
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
  public privateKey!: any

  @IsString()
  public publicKey!: any

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

  private keyBytes(key: any): Buffer {
    switch (this.format) {
      case KeyFormat.Base58: {
        assert(key as Base58KeyRepresentation)
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
