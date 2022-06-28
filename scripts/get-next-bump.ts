// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import conventionalRecommendedBump from 'conventional-recommended-bump'

import lerna from '../lerna.json'

const currentVersion = lerna.version
const currentMajor = Number(currentVersion.split('.')[0])

// eslint-disable-next-line no-restricted-syntax
const enum VersionBump {
  Major = 0,
  Minor = 1,
  Patch = 2,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const whatBump = (commits: any[]) => {
  let versionBump = VersionBump.Patch
  let breaking = 0
  let features = 0

  for (const commit of commits) {
    if (commit.notes.length > 0) {
      breaking += commit.notes.length
    } else if (commit.type === 'feat') {
      features += 1
    }
  }

  if (breaking > 0) {
    // If the current version is less than 1.0.0, then bump the minor version for breaking changes
    versionBump = currentMajor < 1 ? VersionBump.Minor : VersionBump.Major
  } else if (features > 0) {
    // If the current version is less than 1.0.0, then bump the patch version for features
    versionBump = currentMajor < 1 ? VersionBump.Patch : VersionBump.Patch
  }

  let reason = `There is ${breaking} BREAKING CHANGE and ${features} features`
  if (currentMajor < 1) reason += ` in a pre-major release`

  return {
    level: versionBump,
    reason,
  }
}

conventionalRecommendedBump(
  {
    preset: `conventionalcommits`,
    whatBump,
    skipUnstable: true,
  },
  (error: unknown, recommendation: { releaseType: string | undefined }) => {
    if (error) throw error

    // eslint-disable-next-line no-console
    console.log(recommendation.releaseType) // 'major'
  }
)
