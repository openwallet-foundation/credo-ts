import type { AskarError, AskarLibrary } from './importAskar'

import { isOwfAskarLibrary } from './importAskar'

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

export const isAskarError = (
  askarLibrary: AskarLibrary,
  error: Error,
  askarErrorCode?: AskarErrorCode
): error is AskarError => {
  if (isOwfAskarLibrary(askarLibrary)) {
    return error instanceof askarLibrary.AskarError && (askarErrorCode === undefined || error.code === askarErrorCode)
  } else {
    return (
      error instanceof askarLibrary.AriesAskarError && (askarErrorCode === undefined || error.code === askarErrorCode)
    )
  }
}
