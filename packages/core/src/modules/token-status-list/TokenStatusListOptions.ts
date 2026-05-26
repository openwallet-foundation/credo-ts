import { type BitsPerStatus, StatusType } from '@owf/token-status-list'

export type CreateTokenStatusListOptions = {
  format: 'cwt' | 'jwt'
  statusListLength: number
  bitsPerStatus: BitsPerStatus
  statusListUri: string
  aggregationUri?: string

  /**
   * Will determine whether it will be signed or authenticated
   */
  keyId: string
}

export type UpdateTokenStatusListOptions<TSL extends Uint8Array | string> = {
  token: TSL
  status: { index: number; status: StatusType } | Array<{ index: number; status: StatusType }>

  /**
   * Will determine whether it will be signed or authenticated
   */
  keyId: string
}

export type FetchTokenStatusListOptions = {
  uri: string
  acceptedFormats?: Array<'cwt' | 'jwt'>
}
