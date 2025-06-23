import { IsString } from 'class-validator'

import { IsUri } from '../../../../../utils/validators'
import { BitStringStatusListEntry } from './bitstring-status-list'

export interface W3cCredentialStatusOptions {
  id: string
  type: string
}

export type CredentialStatusBasedOnType = W3cCredentialStatus extends { type: 'BitstringStatusListEntry' }
  ? BitStringStatusListEntry
  : W3cCredentialStatus | BitStringStatusListEntry

export enum W3cCredentialStatusSupportedTypes {
  BitstringStatusListEntry = 'BitstringStatusListEntry',
}

export class W3cCredentialStatus {
  public constructor(options: W3cCredentialStatusOptions) {
    if (options) {
      this.id = options.id
      this.type = options.type
    }
  }

  @IsUri()
  @IsString()
  public id!: string

  @IsString()
  public type!: string
}
