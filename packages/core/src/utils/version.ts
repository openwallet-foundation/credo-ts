export function parseVersionString(version: VersionString): Version {
  const [major, minor, patch] = version.split('.')

  return [Number(major), Number(minor), Number(patch ?? '0')]
}

export function isFirstVersionHigherThanSecond(first: Version, second: Version) {
  return (
    first[0] > second[0] ||
    (first[0] === second[0] && first[1] > second[1]) ||
    (first[0] === second[0] && first[1] === second[1] && first[2] > second[2])
  )
}

export function isFirstVersionEqualToSecond(first: Version, second: Version) {
  return first[0] === second[0] && first[1] === second[1] && first[2] === second[2]
}

export type VersionString = `${number}.${number}` | `${number}.${number}.${number}`
export type MajorVersion = number
export type MinorVersion = number
export type PatchVersion = number
export type Version = [MajorVersion, MinorVersion, PatchVersion]
