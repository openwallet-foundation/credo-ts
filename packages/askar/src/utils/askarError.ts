import { AriesAskarError } from '@hyperledger/aries-askar-shared'

export enum AskarErrorCode {
  Success = 0,
  Backend = 1,
  Busy = 2,
  Duplicate = 3,
  Encryption = 4,
  Input = 5,
  NotFound = 6,
  Unexpected = 7,
  Unsupported = 8,
  Custom = 100,
}

export const isAskarError = (error: Error, askarErrorCode?: AskarErrorCode): error is AriesAskarError =>
  error instanceof AriesAskarError && (askarErrorCode === undefined || error.code === askarErrorCode)
