import type { TagsBase } from '../../../storage/BaseRecord'

import assert from 'assert'
import { IsEnum, IsString } from 'class-validator'

import { KeyRepresentationType, KeyType } from '../../../crypto'
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
  keyRepresentationType: KeyRepresentationType
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

  @IsEnum(KeyRepresentationType)
  public keyRepresentationType!: KeyRepresentationType

  @IsString()
  public privateKey!: KeyRepresentation

  @IsString()
  public publicKey!: KeyRepresentation

  public constructor(props: KeyRecordProps) {
    super()

    if (props) {
      this.id = props.kid
      this.kid = props.kid
      this.controller = props.controller
      this.keyType = props.keyType
      this.keyRepresentationType = props.keyRepresentationType
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

  private keyBytes(key: KeyRepresentation): Buffer {
    switch (this.keyRepresentationType) {
      case KeyRepresentationType.Base58: {
        assert(key as Base58KeyRepresentation)
        return TypedArrayEncoder.fromBase58((key as Base58KeyRepresentation).Base58)
      }
      case KeyRepresentationType.Base64: {
        assert(key as Base64KeyRepresentation)
        return TypedArrayEncoder.fromBase64((key as Base64KeyRepresentation).Base64)
      }
      default:
        return Buffer.from([])
    }
  }
}
