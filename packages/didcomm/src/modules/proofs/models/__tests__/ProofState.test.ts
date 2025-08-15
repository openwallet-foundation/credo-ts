import { DidCommProofState } from '../DidCommProofState'

describe('DidCommProofState', () => {
  test('state matches Present Proof 1.0 (RFC 0037) state value', () => {
    expect(DidCommProofState.ProposalSent).toBe('proposal-sent')
    expect(DidCommProofState.ProposalReceived).toBe('proposal-received')
    expect(DidCommProofState.RequestSent).toBe('request-sent')
    expect(DidCommProofState.RequestReceived).toBe('request-received')
    expect(DidCommProofState.PresentationSent).toBe('presentation-sent')
    expect(DidCommProofState.PresentationReceived).toBe('presentation-received')
    expect(DidCommProofState.Declined).toBe('declined')
    expect(DidCommProofState.Done).toBe('done')
  })
})
