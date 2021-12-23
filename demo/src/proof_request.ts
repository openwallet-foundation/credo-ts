import { 
Agent,
ConnectionRecord,
PresentationPreview,
PresentationPreviewAttribute} from '@aries-framework/core'
import inquirer from 'inquirer'

export const new_proof_preview = async () => {
  const answer = await inquirer
    .prompt([
      {
        type: 'input',
        prefix: '',
        name: 'credDef',
        message: "Paste the credential definition here:",
      },
    ])
    const presentationPreview = new PresentationPreview({
      attributes: [
        new PresentationPreviewAttribute({
          name: 'actually happening',
          credentialDefinitionId: answer.credDef,
          value: 'yes',
        })
      ],
    })
  return presentationPreview
}


// export const proof_request = async (klm: Agent, annelein: Agent, connectionRecordAnnelein: ConnectionRecord, credDefId: string) => {
  
//     klm.events.on(ProofEventTypes.ProofStateChanged, (event: ProofStateChangedEvent) => {
//       if (event.payload.proofRecord.state !== ProofState.ProposalReceived) {
//         return
//       }
//       console.log("proof proprosal approved!")
//       klm.proofs.acceptProposal(event.payload.proofRecord.id)
//     })
  
//     // annelein.events.on(ProofEventTypes.ProofStateChanged, async (event: ProofStateChangedEvent) => {
//     //   if (event.payload.proofRecord.state !== ProofState.RequestReceived) {
//     //     return
//     //   }
      
//     //   klm.proofs.acceptProposal(event.payload.proofRecord.id)
//     // })
  
//     const proofRec = await annelein.proofs.proposeProof(connectionRecordAnnelein.id, presentationPreview)
  
//     // setInterval(async () => {
//     //   const reccie = await annelein.proofs.getById(proofRec.id)
//     //   console.log(reccie);
      
//     // }, 1000)
//     // const requestedCredentials = await annelein.proofs.getRequestedCredentialsForProofRequest(proofRec.id)
//   }