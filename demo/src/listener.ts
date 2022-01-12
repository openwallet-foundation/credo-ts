// import { CredentialStateChangedEvent } from "@aries-framework/core"
// import { CredentialState } from "@aries-framework/core"
// import { CredentialEventTypes } from "@aries-framework/core"
// import { Annelein } from "./annelein"
// import { AnneleinInquirer } from "./annelein_inquirer"

// export class ListenerAnnelein{
//     on: boolean
//     anneleinInquirer: AnneleinInquirer

//     constructor(anneleinInquirer: AnneleinInquirer){
//         this.on = false
//         this.anneleinInquirer = anneleinInquirer
//     }

//     private turnListenerOn() {
//         this.on = true
//     }
  
//     private turnListenerOff() {
//         this.on = false
//     }

//     credentialOfferListener(annelein: Annelein) {
//         annelein.agent.events.on(
//           CredentialEventTypes.CredentialStateChanged,
//           async ({ payload }: CredentialStateChangedEvent) => {
//             if (payload.credentialRecord.state === CredentialState.OfferReceived){
//                 this.turnListenerOn()
//                 await this.anneleinInquirer.acceptCredentialOffer(payload)
//                 this.turnListenerOff()
//                 this.anneleinInquirer.processAnswer()
//             }
//             return
//           }
//         )
//     }
// }