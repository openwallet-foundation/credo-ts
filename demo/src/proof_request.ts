import { ProofEventTypes } from '@aries-framework/core';
import { ProofState } from '@aries-framework/core';
import { ProofStateChangedEvent } from '@aries-framework/core';
import { 
Agent,
ConnectionRecord,
PresentationPreview,
PresentationPreviewAttribute} from '@aries-framework/core'

import inquirer from 'inquirer'

const ui = new inquirer.ui.BottomBar();
const credDef = '7KuDTpQh3GJ7Gp6kErpWvM:3:CL:115269:latest'

export const send_proof_proposal = async (annelein: Agent, connectionRecord: ConnectionRecord) => {
  annelein.events.on(
    ProofEventTypes.ProofStateChanged,
    async ({ payload }: ProofStateChangedEvent) => {
      if (payload.proofRecord.state === ProofState.ProposalSent) {
        ui.log.write("\x1b[32m\nproposal sent!\n\x1b[0m");
        return
      }
    }
  )

  const presentationPreview = new PresentationPreview({
      attributes: [
        new PresentationPreviewAttribute({
          name: 'name',
          credentialDefinitionId: credDef,
          value: 'annelein',
        }),
        new PresentationPreviewAttribute({
          name: 'date of birth',
          credentialDefinitionId: credDef,
          value: '09/09/1999',
        }),
        new PresentationPreviewAttribute({
          name: 'country of residence',
          credentialDefinitionId: credDef,
          value: 'the Netherlands',
        })
      ],
    })

  await annelein.proofs.proposeProof(connectionRecord.id, presentationPreview)
}
