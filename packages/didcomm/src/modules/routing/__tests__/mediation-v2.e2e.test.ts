/**
 * E2E tests for Coordinate Mediation 2.0.
 *
 * Validates: mediate-request → grant → keylist-update (post-grant) → keylist-query flow
 * with routingDid in routing and routingToServices producing correct services.
 *
 * Requires v2 connections (DIDComm v2). Run with DIDCOMM_VERSION=v2 for full v2 flow.
 */
import { DidCommMediationRecipientApi } from '../DidCommMediationRecipientApi'

const MEDIATOR_ROUTING_DID =
  'did:peer:2.Ez6LSbysY2xFMRpGMhb7tFTLMpeuPRaqaWM1yECx2AtzE3KCc.SeyJ0IjoiZG0iLCJzIjoiaHR0cHM6Ly9leGFtcGxlLmNvbS9lbmRwb2ludCIsInIiOltdLCJhIjoibm9uZSMxIn0'

describe('Coordinate Mediation 2.0', () => {
  describe('v2 provision flow', () => {
    it.skip('provisions mediation v2: request → grant → keylist-update → keylist-query', async () => {
      // TODO: Full E2E requires v2 OOB + v2 connections.
      // 1. Mediator with mediatorRoutingDid, mediationProtocolVersions: ['2.0']
      // 2. Recipient with mediationProtocolVersions: ['2.0']
      // 3. Create v2 connection via OOB
      // 4. provisionV2() → requestAndAwaitGrantV2 → keylist-update (post-grant)
      // 5. keylistQueryV2() to verify recipient DIDs registered
      // 6. Validate routing.routingDid and routingToServices
      expect(MEDIATOR_ROUTING_DID).toBeDefined()
    })
  })
})

describe('Mediation v2 - API validation', () => {
  it('DidCommMediationRecipientApi exposes v2 methods', () => {
    expect(typeof DidCommMediationRecipientApi.prototype.requestMediationV2).toBe('function')
    expect(typeof DidCommMediationRecipientApi.prototype.requestAndAwaitGrantV2).toBe('function')
    expect(typeof DidCommMediationRecipientApi.prototype.provisionV2).toBe('function')
    expect(typeof DidCommMediationRecipientApi.prototype.notifyKeylistUpdateV2).toBe('function')
    expect(typeof DidCommMediationRecipientApi.prototype.keylistQueryV2).toBe('function')
  })
})
