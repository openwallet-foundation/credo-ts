import { type BitsPerStatus, StatusList, StatusListCwt } from '@owf/token-status-list'
import type { JwsSigner, Jwt } from '../../crypto'
import type { SingleOrArray } from '../../types'
import type { KnownJwaSignatureAlgorithm } from '../kms'
import type { OpenId4VcJwtIssuer } from 'packages/openid4vc/src'

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

export type CreateTokenStatusListOptions<Format extends TokenStatusListFormat = TokenStatusListFormat> = {
  format: Format
  statusList: StatusListInput
  statusListUri: string

  /**
   * The signer of the status list
   */
  signer: JwsSigner

  /**
   * Will determine whether it will be signed or authenticated
   */
  keyId: string

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

  /**
   * Additional claims to include in the token payload.
   * Must be JSON-serializable (e.g. no Uint8Array) for JWT format.
   */
  additionalPayload?: Record<string, unknown>
}

export type TokenStatusListResult =
  | { format: 'cwt'; statusList: Uint8Array; parsed: StatusListCwt }
  | { format: 'jwt'; statusList: string; parsed: Jwt }

export type UpdateTokenStatusListOptions<TSL extends Uint8Array | string> = {
  token: TSL
  status: SingleOrArray<{ index: number; status: number }>

  /**
   * Will determine whether it will be signed or authenticated
   */
  keyId: string

  /**
   * The issuance time of the updated status list token. Defaults to `now`.
   */
  issuedAt?: Date

  /**
   * Used to derive `issuedAt` when `issuedAt` is not provided. Defaults to the current time.
   * Not included in the token itself.
   */
  now?: Date

  /**
   * The expiration time of the updated status list token.
   */
  expiresAt?: Date

  /**
   * Time-to-live in seconds.
   */
  timeToLive?: number

  /**
   * Additional claims to include in the token payload.
   * Must be JSON-serializable (no Uint8Array) for JWT format.
   */
  additionalPayload?: Record<string, unknown>
}

export type FetchTokenStatusListOptions<AcceptedFormats extends TokenStatusListFormat = TokenStatusListFormat> = {
  uri: string
  acceptedFormats?: AcceptedFormats[]
}

export type TokenStatusListResultFor<Format extends TokenStatusListFormat> = Extract<
  TokenStatusListResult,
  { format: Format }
>
