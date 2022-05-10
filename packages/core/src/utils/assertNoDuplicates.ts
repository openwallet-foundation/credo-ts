import { AriesFrameworkError } from '../error/AriesFrameworkError'

export function assertNoDuplicatesInArray(arr: string[]) {
  const arrayLength = arr.length
  const uniqueArrayLength = new Set(arr).size

  if (arrayLength === uniqueArrayLength) return

  const duplicates = arr.filter((item, index) => arr.indexOf(item) != index)
  throw new AriesFrameworkError(`The proof request contains duplicate items: ${duplicates.toString()}`)
}
