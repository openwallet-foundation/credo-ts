import { DidCommAttachment, DidCommAttachmentData } from '@credo-ts/didcomm'
import { getAgentContext } from '../../../../core/tests'
import { InMemoryAnonCredsRegistry } from '../../../tests/InMemoryAnonCredsRegistry'
import { AnonCredsModuleConfig } from '../../AnonCredsModuleConfig'
import { AnonCredsDidCommCredentialFormatService } from '../AnonCredsDidCommCredentialFormatService'
import { AnonCredsDidCommProofFormatService } from '../AnonCredsDidCommProofFormatService'

const did = 'did:indy:pool:localtest:TL1EaPFCZ8Si5aUrqScBDt'
const encodedCredentialDefinitionId = `${did}/anoncreds/v0/CLAIM_DEF/10/my%20tag`
const unencodedCredentialDefinitionId = `${did}/anoncreds/v0/CLAIM_DEF/10/my tag`

const attachment = (json: Record<string, unknown>) =>
  new DidCommAttachment({ data: new DidCommAttachmentData({ json: json as Record<string, string> }) })
const agentContext = getAgentContext({
  registerInstances: [
    [AnonCredsModuleConfig, { registries: [new InMemoryAnonCredsRegistry()] } as unknown as AnonCredsModuleConfig],
  ],
})

describe('auto respond with identifiers in different forms', () => {
  const credentialFormatService = new AnonCredsDidCommCredentialFormatService()
  const proofFormatService = new AnonCredsDidCommProofFormatService()

  test('credentials: auto responds when the credential definition ids are forms of the same id', async () => {
    const proposalAttachment = attachment({ cred_def_id: unencodedCredentialDefinitionId })
    const offerAttachment = attachment({ cred_def_id: encodedCredentialDefinitionId })
    const requestAttachment = attachment({ cred_def_id: unencodedCredentialDefinitionId })

    expect(
      await credentialFormatService.shouldAutoRespondToProposal(agentContext, {
        proposalAttachment,
        offerAttachment,
      } as never)
    ).toBe(true)
    expect(
      await credentialFormatService.shouldAutoRespondToOffer(agentContext, {
        proposalAttachment,
        offerAttachment,
      } as never)
    ).toBe(true)
    expect(
      await credentialFormatService.shouldAutoRespondToRequest(agentContext, {
        offerAttachment,
        requestAttachment,
      } as never)
    ).toBe(true)
  })

  test('credentials: does not auto respond when the credential definition ids differ', async () => {
    expect(
      await credentialFormatService.shouldAutoRespondToProposal(agentContext, {
        proposalAttachment: attachment({ cred_def_id: `${did}/anoncreds/v0/CLAIM_DEF/10/other` }),
        offerAttachment: attachment({ cred_def_id: encodedCredentialDefinitionId }),
      } as never)
    ).toBe(false)
  })

  test('proofs: auto responds when the restriction ids are forms of the same id', async () => {
    const proofRequest = (credentialDefinitionId: string) =>
      attachment({
        name: 'proof',
        version: '1.0',
        nonce: '1',
        requested_attributes: { a: { name: 'name', restrictions: [{ cred_def_id: credentialDefinitionId }] } },
        requested_predicates: {},
      })

    expect(
      await proofFormatService.shouldAutoRespondToProposal(agentContext, {
        proposalAttachment: proofRequest(unencodedCredentialDefinitionId),
        requestAttachment: proofRequest(encodedCredentialDefinitionId),
      } as never)
    ).toBe(true)
    expect(
      await proofFormatService.shouldAutoRespondToRequest(agentContext, {
        proposalAttachment: proofRequest(encodedCredentialDefinitionId),
        requestAttachment: proofRequest(`${did}/anoncreds/v0/CLAIM_DEF/10/other`),
      } as never)
    ).toBe(false)
  })
})
