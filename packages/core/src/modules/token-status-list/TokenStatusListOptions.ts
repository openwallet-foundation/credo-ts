import { type BitsPerStatus, StatusList, StatusListCwt } from '@owf/token-status-list'
import type { Jwt } from '../../crypto'
import type { SingleOrArray } from '../../types'
import type { KnownJwaSignatureAlgorithm } from '../kms'
import type { TokenStatusListSigner } from './TokenStatusListSigner'

export type TokenStatusListFormat = 'cwt' | 'jwt'

/**
 * Options for specifying the status list contents either as a pre-built instance
 * or as construction parameters.
 */
export type StatusListInput =
  | StatusList
  | {
      statusListLength: number
      bitsPerStatus: BitsPerStatus
      aggregationUri?: string
    }

type CreateBaseTokenStatusListOptions = {
  statusList: StatusListInput
  statusListUri: string

  signer: TokenStatusListSigner

  alg: KnownJwaSignatureAlgorithm

  /**
   * The issuance time of the status list token. Defaults to `now`.
   */
  issuedAt?: Date

  /**
   * Used to derive `issuedAt` when `issuedAt` is not provided. Defaults to the current time.
   * Not included in the token itself.
   */
  now?: Date

  /**
   * The expiration time of the status list token.
   */
  expiresAt?: Date

  /**
   * Time-to-live in seconds. Instructs relying parties how long to cache the status list.
   */
  timeToLive?: number
}

type CreateCwtTokenStatusListOptions = {
  format: 'cwt'

  /**
   * Additional claims to include in the token payload.
   */
  additionalPayload?: Map<number | string, unknown>
} & CreateBaseTokenStatusListOptions

type CreateJwtTokenStatusListOptions = {
  format: 'jwt'
  statusList: StatusListInput
  statusListUri: string

  /**
   * Additional claims to include in the token payload.
   */
  additionalPayload?: Record<string, unknown>
} & CreateBaseTokenStatusListOptions

export type CreateTokenStatusListOptions = CreateJwtTokenStatusListOptions | CreateCwtTokenStatusListOptions

export type TokenStatusListResult =
  | { format: 'cwt'; statusList: Uint8Array; parsed: StatusListCwt }
  | { format: 'jwt'; statusList: string; parsed: Jwt }

type UpdateBaseTokenStatusListOptions = Omit<CreateBaseTokenStatusListOptions, 'statusList' | 'statusListUri'> & {
  status: SingleOrArray<{ index: number; status: number }>
}

type UpdateCwtTokenStatusListOptions = {
  format: 'cwt'
  token: Uint8Array

  /**
   * Additional claims to include in the token payload.
   */
  additionalPayload?: Map<number | string, unknown>
} & UpdateBaseTokenStatusListOptions

type UpdateJwtTokenStatusListOptions = {
  format: 'jwt'
  token: string

  /**
   * Additional claims to include in the token payload.
   */
  additionalPayload?: Record<string, unknown>
} & UpdateBaseTokenStatusListOptions

export type UpdateTokenStatusListOptions = UpdateCwtTokenStatusListOptions | UpdateJwtTokenStatusListOptions

export type FetchTokenStatusListOptions<AcceptedFormats extends TokenStatusListFormat = TokenStatusListFormat> = {
  uri: string
  acceptedFormats?: AcceptedFormats[]
}

export type TokenStatusListResultFor<Format extends TokenStatusListFormat> = Extract<
  TokenStatusListResult,
  { format: Format }
>
