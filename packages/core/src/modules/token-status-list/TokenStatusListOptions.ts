import { type BitsPerStatus, StatusType } from '@owf/token-status-list'

export type CreateTokenStatusListOptions = {
  format: 'cwt' | 'jwt'
  statusListLength: number
  bitsPerStatus: BitsPerStatus
  hostingUri: string
  aggregationUri?: string

  /**
   * Will determine whether it will be signed or authenticated
   */
  keyId: string
}

export type UpdateTokenStatusListOptions<TSL extends Uint8Array | string> = {
  token: TSL
  index: number
  value: StatusType

  /**
   * Will determine whether it will be signed or authenticated
   */
  keyId: string
}

export type BatchUpdateTokenStatusListOptions<TSL extends Uint8Array | string> = {
  token: TSL
  indexAndValue: Array<[number, StatusType]>

  /**
   * Will determine whether it will be signed or authenticated
   */
  keyId: string
}

export type FetchTokenStatusListOptions = {
  uri: string
}
