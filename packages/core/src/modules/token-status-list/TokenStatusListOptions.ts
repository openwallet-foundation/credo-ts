import { type BitsPerStatus, StatusListCwt, StatusType } from '@owf/token-status-list'
import type { Jwt } from '../../crypto'
import type { SingleOrArray } from '../../types'

export type TokenStatusListFormat = 'cwt' | 'jwt'

export type CreateTokenStatusListOptions<Format extends TokenStatusListFormat = TokenStatusListFormat> = {
  format: Format
  statusListLength: number
  bitsPerStatus: BitsPerStatus
  statusListUri: string
  aggregationUri?: string

  /**
   * Will determine whether it will be signed or authenticated
   */
  keyId: string
}

export type TokenStatusListResult =
  | { format: 'cwt'; statusList: Uint8Array; parsed: StatusListCwt }
  | { format: 'jwt'; statusList: string; parsed: Jwt }

export type UpdateTokenStatusListOptions<TSL extends Uint8Array | string> = {
  token: TSL
  status: SingleOrArray<{ index: number; status: StatusType }>

  /**
   * Will determine whether it will be signed or authenticated
   */
  keyId: string
}

export type FetchTokenStatusListOptions<AcceptedFormats extends TokenStatusListFormat = TokenStatusListFormat> = {
  uri: string
  acceptedFormats?: AcceptedFormats[]
}

export type TokenStatusListResultFor<Format extends TokenStatusListFormat> = Extract<
  TokenStatusListResult,
  { format: Format }
>
