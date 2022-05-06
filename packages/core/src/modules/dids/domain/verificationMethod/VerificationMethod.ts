import type { Buffer } from '../../../../utils'

import { IsString, IsOptional } from 'class-validator'

import { KeyType } from '../../../../crypto'
import { AriesFrameworkError } from '../../../../error'
import { TypedArrayEncoder } from '../../../../utils'

export enum VerificationKeyType {
  Ed25519VerificationKey2018 = 'Ed25519VerificationKey2018',
  Ed25519VerificationKey2020 = 'Ed25519VerificationKey2020',
  X25519KeyAgreementKey2019 = 'X25519KeyAgreementKey2019',
  EcdsaSecp256k1VerificationKey2019 = 'EcdsaSecp256k1VerificationKey2019',
}

export const verificationKeyTypeToKeyTypeMapping: Record<string, KeyType> = {
  [VerificationKeyType.Ed25519VerificationKey2018]: KeyType.Ed25519,
  [VerificationKeyType.Ed25519VerificationKey2020]: KeyType.Ed25519,
  [VerificationKeyType.X25519KeyAgreementKey2019]: KeyType.X25519,
  [VerificationKeyType.EcdsaSecp256k1VerificationKey2019]: KeyType.Secp256k1,
}

export const keyTypeToVerificationKeyTypeMapping: Record<string, VerificationKeyType> = {
  [KeyType.Ed25519]: VerificationKeyType.Ed25519VerificationKey2018,
  [KeyType.X25519]: VerificationKeyType.X25519KeyAgreementKey2019,
  [KeyType.Secp256k1]: VerificationKeyType.EcdsaSecp256k1VerificationKey2019,
}

export interface VerificationMethodOptions {
  id: string
  type: string
  controller: string
  publicKeyBase58?: string
  publicKeyBase64?: string
  publicKeyJwk?: Record<string, unknown>
  publicKeyHex?: string
  publicKeyMultibase?: string
  publicKeyPem?: string
  blockchainAccountId?: string
  ethereumAddress?: string
}

export class VerificationMethod {
  public constructor(options: VerificationMethodOptions) {
    if (options) {
      this.id = options.id
      this.type = options.type
      this.controller = options.controller
      this.publicKeyBase58 = options.publicKeyBase58
      this.publicKeyBase64 = options.publicKeyBase64
      this.publicKeyJwk = options.publicKeyJwk
      this.publicKeyHex = options.publicKeyHex
      this.publicKeyMultibase = options.publicKeyMultibase
      this.publicKeyPem = options.publicKeyPem
      this.blockchainAccountId = options.blockchainAccountId
      this.ethereumAddress = options.ethereumAddress
    }
  }

  @IsString()
  public id!: string

  @IsString()
  public type!: string

  @IsString()
  public controller!: string

  @IsOptional()
  @IsString()
  public publicKeyBase58?: string

  @IsOptional()
  @IsString()
  public publicKeyBase64?: string

  // TODO: define JWK structure, we don't support JWK yet
  public publicKeyJwk?: Record<string, unknown>

  @IsOptional()
  @IsString()
  public publicKeyHex?: string

  @IsOptional()
  @IsString()
  public publicKeyMultibase?: string

  @IsOptional()
  @IsString()
  public publicKeyPem?: string

  @IsOptional()
  @IsString()
  public blockchainAccountId?: string

  @IsOptional()
  @IsString()
  public ethereumAddress?: string

  public get keyBytes(): Buffer {
    if (this.publicKeyBase58) {
      return TypedArrayEncoder.fromBase58(this.publicKeyBase58)
    }
    if (this.publicKeyBase64) {
      return TypedArrayEncoder.fromBase64(this.publicKeyBase64)
    }
    throw new AriesFrameworkError(`IMPLEMENT ALL CASES`)
  }
}
