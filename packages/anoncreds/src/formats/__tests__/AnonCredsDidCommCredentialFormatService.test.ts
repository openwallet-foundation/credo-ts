import type { AgentContext } from '@credo-ts/core'
import { DidCommAttachment, DidCommAttachmentData } from '@credo-ts/didcomm'
import { AnonCredsDidCommCredentialFormatService } from '../AnonCredsDidCommCredentialFormatService'

const did = 'did:indy:pool:localtest:TL1EaPFCZ8Si5aUrqScBDt'
const encodedCredentialDefinitionId = `${did}/anoncreds/v0/CLAIM_DEF/10/my%20tag`
const unencodedCredentialDefinitionId = `${did}/anoncreds/v0/CLAIM_DEF/10/my tag`

const attachment = (json: Record<string, string>) =>
  new DidCommAttachment({ data: new DidCommAttachmentData({ json }) })
const agentContext = {} as AgentContext

describe('AnonCredsDidCommCredentialFormatService', () => {
  const formatService = new AnonCredsDidCommCredentialFormatService()

  test('auto responds when the credential definition ids differ only in percent-encoding', async () => {
    const proposalAttachment = attachment({ cred_def_id: unencodedCredentialDefinitionId })
    const offerAttachment = attachment({ cred_def_id: encodedCredentialDefinitionId })
    const requestAttachment = attachment({ cred_def_id: unencodedCredentialDefinitionId })

    expect(
      await formatService.shouldAutoRespondToProposal(agentContext, { proposalAttachment, offerAttachment } as never)
    ).toBe(true)
    expect(
      await formatService.shouldAutoRespondToOffer(agentContext, { proposalAttachment, offerAttachment } as never)
    ).toBe(true)
    expect(
      await formatService.shouldAutoRespondToRequest(agentContext, { offerAttachment, requestAttachment } as never)
    ).toBe(true)
  })

  test('does not auto respond when the credential definition ids differ', async () => {
    expect(
      await formatService.shouldAutoRespondToProposal(agentContext, {
        proposalAttachment: attachment({ cred_def_id: `${did}/anoncreds/v0/CLAIM_DEF/10/other` }),
        offerAttachment: attachment({ cred_def_id: encodedCredentialDefinitionId }),
      } as never)
    ).toBe(false)
  })
})
