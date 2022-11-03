export function parseVersionString(version: VersionString): Version {
  const [major, minor] = version.split('.')

  return [Number(major), Number(minor)]
}

export function isFirstVersionHigherThanSecond(first: Version, second: Version) {
  return first[0] > second[0] || (first[0] == second[0] && first[1] > second[1])
}

export function isFirstVersionEqualToSecond(first: Version, second: Version) {
  return first[0] === second[0] && first[1] === second[1]
}

export type VersionString = `${number}.${number}`
export type MajorVersion = number
export type MinorVersion = number
export type Version = [MajorVersion, MinorVersion]
