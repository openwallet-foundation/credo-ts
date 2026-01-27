import type { VersionString } from '../../utils/version'
import { isFirstVersionEqualToSecond, isFirstVersionHigherThanSecond, parseVersionString } from '../../utils/version'
import type { UpdateToVersion } from './updates'

import { CURRENT_FRAMEWORK_STORAGE_VERSION } from './updates'

export function isStorageUpToDate(storageVersion: VersionString, updateToVersion?: UpdateToVersion) {
  const currentStorageVersion = parseVersionString(storageVersion)
  const compareToVersion = parseVersionString(updateToVersion ?? CURRENT_FRAMEWORK_STORAGE_VERSION)

  const isUpToDate =
    isFirstVersionEqualToSecond(currentStorageVersion, compareToVersion) ||
    isFirstVersionHigherThanSecond(currentStorageVersion, compareToVersion)

  return isUpToDate
}
