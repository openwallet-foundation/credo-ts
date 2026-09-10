import type { AgentContext } from '../../../agent'
import { ClaimFormat, W3cV2Presentation } from '../models'
import { W3cV2CredentialsApi } from '../W3cV2CredentialsApi'

describe('W3cV2CredentialsApi', () => {
  test('signCredential forwards di_vc options to service', async () => {
    const signCredential = vi.fn().mockResolvedValue({ claimFormat: ClaimFormat.DiVc })

    const service = {
      signCredential,
    }

    const api = new W3cV2CredentialsApi({} as AgentContext, service as never)

    const options = {
      format: ClaimFormat.DiVc,
      credential: {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        type: ['VerifiableCredential'],
        issuer: 'did:example:issuer',
        credentialSubject: { id: 'did:example:subject' },
      },
      verificationMethod: 'did:example:issuer#key-1',
      cryptosuite: 'eddsa-jcs-2022',
    }

    await api.signCredential(options as never)

    expect(signCredential).toHaveBeenCalledTimes(1)
    expect(signCredential).toHaveBeenCalledWith(expect.anything(), options)
  })

  test('signPresentation forwards di_vp options to service', async () => {
    const signPresentation = vi.fn().mockResolvedValue({ claimFormat: ClaimFormat.DiVp })

    const service = {
      signPresentation,
    }

    const api = new W3cV2CredentialsApi({} as AgentContext, service as never)

    const presentation = new W3cV2Presentation({
      context: ['https://www.w3.org/ns/credentials/v2'],
      type: ['VerifiablePresentation'],
      holder: 'did:example:holder',
    })

    const options = {
      format: ClaimFormat.DiVp,
      presentation,
      challenge: 'test-challenge',
      domain: 'example.com',
      verificationMethod: 'did:example:holder#key-1',
      cryptosuite: 'eddsa-jcs-2022',
    }

    await api.signPresentation(options as never)

    expect(signPresentation).toHaveBeenCalledTimes(1)
    expect(signPresentation).toHaveBeenCalledWith(expect.anything(), options)
  })
})
