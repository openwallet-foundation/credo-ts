export function describeSkipNode18(...parameters: Parameters<typeof describe>) {
  const version = process.version

  if (version.startsWith('v18.')) {
    describe.skip(...parameters)
  } else {
    describe(...parameters)
  }
}
