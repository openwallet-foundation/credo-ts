import { getSignerForDataIntegrityProof } from '../v2-di-utils'

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

  const agentContext = {
    dependencyManager: {
      resolve: vi.fn().mockReturnValue({
        resolveDidDocument: vi.fn().mockResolvedValue({ dereferenceKey }),
      }),
    },
  } as never

  beforeEach(() => {
    vi.clearAllMocks()
    dereferenceKey.mockImplementation((id: string) => ({
      id,
      controller: id.split('#')[0],
    }))
  })

  test('getSignerForDataIntegrityProof returns the controller of the resolved verification method', async () => {
    const presentation = createPresentation(createProof())

    await expect(getSignerForDataIntegrityProof(agentContext, presentation, 'authentication')).resolves.toBe(signerDid)
    expect(dereferenceKey).toHaveBeenCalledWith(verificationMethodId, ['authentication'])
  })

  test('getSignerForDataIntegrityProof rejects when no proof is present', async () => {
    await expect(
      getSignerForDataIntegrityProof(agentContext, createPresentation([]), 'authentication')
    ).rejects.toThrow('does not contain a proof with a verification method')
  })

  test('getSignerForDataIntegrityProof rejects an ambiguous proof set', async () => {
    const presentation = createPresentation([createProof(), createProof(otherVerificationMethodId)])

    await expect(getSignerForDataIntegrityProof(agentContext, presentation, 'authentication')).rejects.toThrow(
      'Unable to determine the signer'
    )
  })

  test('getSignerForDataIntegrityProof disambiguates a proof set using the expected controller', async () => {
    const presentation = createPresentation([createProof(), createProof(otherVerificationMethodId)])

    await expect(
      getSignerForDataIntegrityProof(agentContext, presentation, 'authentication', otherSignerDid)
    ).resolves.toBe(otherSignerDid)
  })

  test('getSignerForDataIntegrityProof rejects a proof set when no proof is controlled by the expected controller', async () => {
    const presentation = createPresentation([createProof(), createProof(otherVerificationMethodId)])

    await expect(
      getSignerForDataIntegrityProof(agentContext, presentation, 'authentication', 'did:key:zUnrelated')
    ).rejects.toThrow('none of which is controlled by')
  })

  test('getSignerForDataIntegrityProof accepts a proof set that names the same verification method', async () => {
    const presentation = createPresentation([createProof(), createProof()])

    await expect(getSignerForDataIntegrityProof(agentContext, presentation, 'authentication')).resolves.toBe(signerDid)
  })

  test('getSignerForDataIntegrityProof rejects a verification method without a controller', async () => {
    dereferenceKey.mockReturnValue({ id: verificationMethodId })
    const presentation = createPresentation(createProof())

    await expect(getSignerForDataIntegrityProof(agentContext, presentation, 'authentication')).rejects.toThrow(
      'does not have a controller'
    )
  })
})
