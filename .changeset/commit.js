import { execSync } from 'node:child_process'

const getSignedOffBy = () => {
  const gitUserName = execSync('git config user.name').toString('utf-8').trim()
  const gitEmail = execSync('git config user.email').toString('utf-8').trim()

  return `Signed-off-by: ${gitUserName} <${gitEmail}>`
}

export const getAddMessage = async (changeset) => {
  return `docs(changeset): ${changeset.summary}\n\n${getSignedOffBy()}\n`
}

export const getVersionMessage = async (releasePlan) => {
  const publishableReleases = releasePlan.releases.filter((release) => release.type !== 'none')
  const releasedVersion = publishableReleases[0].newVersion

  return `chore(release): version ${releasedVersion}\n\n${getSignedOffBy()}\n`
}
