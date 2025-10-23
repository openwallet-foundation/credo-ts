import { DidCommProofsModuleConfig } from '../DidCommProofsModuleConfig'
import { DidCommAutoAcceptProof } from '../models'
import type { DidCommProofProtocol } from '../protocol/DidCommProofProtocol'

describe('ProofsModuleConfig', () => {
  test('sets default values', () => {
    const config = new DidCommProofsModuleConfig({
      proofProtocols: [],
    })

    expect(config.autoAcceptProofs).toBe(DidCommAutoAcceptProof.Never)
    expect(config.proofProtocols).toEqual([])
  })

  test('sets values', () => {
    const proofProtocol = vi.fn() as unknown as DidCommProofProtocol
    const config = new DidCommProofsModuleConfig({
      autoAcceptProofs: DidCommAutoAcceptProof.Always,
      proofProtocols: [proofProtocol],
    })

    expect(config.autoAcceptProofs).toBe(DidCommAutoAcceptProof.Always)
    expect(config.proofProtocols).toEqual([proofProtocol])
  })
})
