import { resolveDataIntegritySigner } from '../v2-di-utils'

const signerDid = 'did:key:z6MkhaXgBZDvotDkL5257faWxcERCqyLmqwK8PrMUA34yPv1'
const verificationMethodId = `${signerDid}#z6MkhaXgBZDvotDkL5257faWxcERCqyLmqwK8PrMUA34yPv1`

const otherSignerDid = 'did:key:z6MkqgkLrRyLg6bqk27djwbbaQWgaSYgFVCKq9YKxZbNkpVv'
const otherVerificationMethodId = `${otherSignerDid}#z6MkqgkLrRyLg6bqk27djwbbaQWgaSYgFVCKq9YKxZbNkpVv`

function createProof(vmId: string = verificationMethodId) {
  return {
    type: 'DataIntegrityProof',
    cryptosuite: 'eddsa-jcs-2022',
    verificationMethod: vmId,
    proofValue: 'z58DAdFfa9SkqZMVPxAQp...jQCrfFPP2oumHKtz',
  }
}

function createPresentation(proof: unknown) {
  return { proof }
}

describe('v2-di-utils', () => {
  const dereferenceKey = vi.fn()
  const resolveDidDocument = vi.fn()

  const agentContext = {
    dependencyManager: {
      resolve: vi.fn().mockReturnValue({ resolveDidDocument }),
    },
  } as never

  beforeEach(() => {
    vi.clearAllMocks()
    resolveDidDocument.mockImplementation(async (didUrl: string) => ({ id: didUrl.split('#')[0], dereferenceKey }))
    dereferenceKey.mockImplementation((id: string) => ({
      id,
      controller: id.split('#')[0],
    }))
  })

  test('resolveDataIntegritySigner returns the DID that controls the resolved verification method', async () => {
    const presentation = createPresentation(createProof())

    await expect(resolveDataIntegritySigner(agentContext, presentation, 'authentication')).resolves.toMatchObject({
      signer: signerDid,
    })
    expect(dereferenceKey).toHaveBeenCalledWith(verificationMethodId, ['authentication'])
  })

  test('resolveDataIntegritySigner rejects when no proof is present', async () => {
    await expect(resolveDataIntegritySigner(agentContext, createPresentation([]), 'authentication')).rejects.toThrow(
      'does not contain a proof with a verification method'
    )
  })

  test('resolveDataIntegritySigner rejects an ambiguous proof set', async () => {
    const presentation = createPresentation([createProof(), createProof(otherVerificationMethodId)])

    await expect(resolveDataIntegritySigner(agentContext, presentation, 'authentication')).rejects.toThrow(
      'Unable to determine the signer'
    )
  })

  test('resolveDataIntegritySigner disambiguates a proof set using the expected signer', async () => {
    const presentation = createPresentation([createProof(), createProof(otherVerificationMethodId)])

    await expect(
      resolveDataIntegritySigner(agentContext, presentation, 'authentication', otherSignerDid)
    ).resolves.toMatchObject({ signer: otherSignerDid })
  })

  test('resolveDataIntegritySigner only resolves the proof of the expected signer in a proof set', async () => {
    resolveDidDocument.mockImplementation(async (didUrl: string) => {
      if (didUrl.startsWith(otherSignerDid)) throw new Error(`Unable to resolve did '${otherSignerDid}'`)
      return { id: didUrl.split('#')[0], dereferenceKey }
    })
    const presentation = createPresentation([createProof(otherVerificationMethodId), createProof()])

    await expect(
      resolveDataIntegritySigner(agentContext, presentation, 'authentication', signerDid)
    ).resolves.toMatchObject({ signer: signerDid })
    expect(resolveDidDocument).toHaveBeenCalledTimes(1)
    expect(resolveDidDocument).toHaveBeenCalledWith(verificationMethodId)
  })

  test('resolveDataIntegritySigner rejects a proof set when no proof is signed by the expected signer', async () => {
    const presentation = createPresentation([createProof(), createProof(otherVerificationMethodId)])

    await expect(
      resolveDataIntegritySigner(agentContext, presentation, 'authentication', 'did:key:zUnrelated')
    ).rejects.toThrow('none of which is signed by')
  })

  test('resolveDataIntegritySigner accepts a proof set that names the same verification method', async () => {
    const presentation = createPresentation([createProof(), createProof()])

    await expect(resolveDataIntegritySigner(agentContext, presentation, 'authentication')).resolves.toMatchObject({
      signer: signerDid,
    })
  })

  test('resolveDataIntegritySigner rejects a verification method without a controller', async () => {
    dereferenceKey.mockReturnValue({ id: verificationMethodId })
    const presentation = createPresentation(createProof())

    await expect(resolveDataIntegritySigner(agentContext, presentation, 'authentication')).rejects.toThrow(
      `Verification method '${verificationMethodId}' is controlled by 'undefined'`
    )
  })

  test('resolveDataIntegritySigner rejects a verification method controlled by another DID', async () => {
    dereferenceKey.mockReturnValue({ id: verificationMethodId, controller: otherSignerDid })
    const presentation = createPresentation(createProof())

    await expect(resolveDataIntegritySigner(agentContext, presentation, 'authentication')).rejects.toThrow(
      `Verification method '${verificationMethodId}' is controlled by '${otherSignerDid}', not by the DID document '${signerDid}' it is listed in`
    )
  })
})
