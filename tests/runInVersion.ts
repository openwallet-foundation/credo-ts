type NodeVersions = 14 | 16 | 17 | 18

export function describeRunInNodeVersion(versions: NodeVersions[], ...parameters: Parameters<typeof describe>) {
  const runtimeVersion = process.version
  const mappedVersions = versions.map((version) => `v${version}.`)

  if (mappedVersions.some((version) => runtimeVersion.startsWith(version))) {
    describe(...parameters)
  } else {
    describe.skip(...parameters)
  }
}
