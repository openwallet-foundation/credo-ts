import { type BitsPerStatus, StatusListCwt, StatusType } from '@owf/token-status-list'
import type { Jwt } from '../../crypto'
import type { SingleOrArray } from '../../types'
import type { KnownJwaSignatureAlgorithm } from '../kms'
import type { TokenStatusListSigner } from './TokenStatusListSigner'

export type TokenStatusListFormat = 'cwt' | 'jwt'

export type CreateTokenStatusListOptions<Format extends TokenStatusListFormat = TokenStatusListFormat> = {
  format: Format
  statusListLength: number
  bitsPerStatus: BitsPerStatus
  statusListUri: string
  aggregationUri?: string

  signer: TokenStatusListSigner
  algorithm?: KnownJwaSignatureAlgorithm

  claims?: {
    issuedAt?: Date
    expirationTime?: Date
    timeToLive?: number
    additionalClaims?: Map<number | string, unknown>
  }
}

export type TokenStatusListResult =
  | { format: 'cwt'; statusList: Uint8Array; parsed: StatusListCwt }
  | { format: 'jwt'; statusList: string; parsed: Jwt }

export type UpdateTokenStatusListOptions<TSL extends Uint8Array | string> = {
  token: TSL
  status: SingleOrArray<{ index: number; status: StatusType }>

  signer: TokenStatusListSigner
  algorithm?: KnownJwaSignatureAlgorithm
}

export type FetchTokenStatusListOptions<AcceptedFormats extends TokenStatusListFormat = TokenStatusListFormat> = {
  uri: string
  acceptedFormats?: AcceptedFormats[]
}

export type TokenStatusListResultFor<Format extends TokenStatusListFormat> = Extract<
  TokenStatusListResult,
  { format: Format }
>
