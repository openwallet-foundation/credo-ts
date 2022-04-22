import type { TagsBase } from '../../../storage/BaseRecord'

import { IsEnum, IsString } from 'class-validator'

import { KeyType } from '../../../key-manager/KeyManager'
import { BaseRecord } from '../../../storage/BaseRecord'

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
  controller: string
  keyType: KeyType
  privateKey: KeyRepresentation
  publicKey: KeyRepresentation
}

export class KeyRecord extends BaseRecord<DefaultKeyTags, CustomKeyTags> {
  @IsString()
  public kid!: string

  @IsString()
  public controller!: string

  @IsEnum(KeyType)
  public keyType!: KeyType

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
}
