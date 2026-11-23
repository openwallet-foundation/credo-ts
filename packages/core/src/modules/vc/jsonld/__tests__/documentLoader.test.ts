import { DidKey } from '../../../dids'
import { PublicJwk } from '../../../kms'
import { defaultDocumentLoader } from '../documentLoader'

describe('defaultDocumentLoader', () => {
  const didKey = new DidKey(PublicJwk.fromFingerprint('z6MkvBpZTRb7tjuUF5AkmhG1JDV928hZbg5KAQJcogvhz9ax'))
  const fragment = `#${didKey.publicJwk.fingerprint}`
  const resolve = async () => ({ didDocument: didKey.didDocument, didResolutionMetadata: {}, didDocumentMetadata: {} })
  const loader = defaultDocumentLoader({ dependencyManager: { resolve: () => ({ resolve }) } } as never)

  test('frames a DID URL to the verification method it names', async () => {
    const { document } = await loader(`${didKey.did}${fragment}`)

    expect(document).toMatchObject({ id: `${didKey.did}${fragment}`, type: 'Ed25519VerificationKey2018' })
  })

  // Framing matches the node whose id is the exact URL, so these return no verification method rather than throwing
  test.each([
    ['a query', `${didKey.did}?versionId=1${fragment}`],
    ['a path', `${didKey.did}/path${fragment}`],
    ['an empty fragment', `${didKey.did}#`],
  ])('returns no verification method for a DID URL with %s', async (_, url) => {
    const { document } = await loader(url)

    expect(document).not.toHaveProperty('id')
  })
})
