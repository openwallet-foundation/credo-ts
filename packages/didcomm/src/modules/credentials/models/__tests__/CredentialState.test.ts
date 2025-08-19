import { DidCommCredentialState } from '../DidCommCredentialState'

describe('DidCommCredentialState', () => {
  test('state matches Issue Credential 1.0 (RFC 0036) state value', () => {
    expect(DidCommCredentialState.ProposalSent).toBe('proposal-sent')
    expect(DidCommCredentialState.ProposalReceived).toBe('proposal-received')
    expect(DidCommCredentialState.OfferSent).toBe('offer-sent')
    expect(DidCommCredentialState.OfferReceived).toBe('offer-received')
    expect(DidCommCredentialState.Declined).toBe('declined')
    expect(DidCommCredentialState.RequestSent).toBe('request-sent')
    expect(DidCommCredentialState.RequestReceived).toBe('request-received')
    expect(DidCommCredentialState.CredentialIssued).toBe('credential-issued')
    expect(DidCommCredentialState.CredentialReceived).toBe('credential-received')
    expect(DidCommCredentialState.Done).toBe('done')
  })

  test('state matches Issue Credential 2.0 (RFC 0453) state value', () => {
    expect(DidCommCredentialState.ProposalSent).toBe('proposal-sent')
    expect(DidCommCredentialState.ProposalReceived).toBe('proposal-received')
    expect(DidCommCredentialState.OfferSent).toBe('offer-sent')
    expect(DidCommCredentialState.OfferReceived).toBe('offer-received')
    expect(DidCommCredentialState.Declined).toBe('declined')
    expect(DidCommCredentialState.RequestSent).toBe('request-sent')
    expect(DidCommCredentialState.RequestReceived).toBe('request-received')
    expect(DidCommCredentialState.CredentialIssued).toBe('credential-issued')
    expect(DidCommCredentialState.CredentialReceived).toBe('credential-received')
    expect(DidCommCredentialState.Done).toBe('done')
  })
})
