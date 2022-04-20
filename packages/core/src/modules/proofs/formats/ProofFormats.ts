import type { ProofFormatSpec } from './models/ProofFormatSpec'

type V2ProofAttachmentFormat = {
  [id: string]: {
    indy: ProofFormatSpec
    ldproof: ProofFormatSpec
  }
}

const INDY_ATTACH_ID = 'indy'
const V2_INDY_PRESENTATION_PROPOSAL = 'hlindy/proof-req@v2.0'
const V2_INDY_PRESENTATION_REQUEST = 'hlindy/proof-req@v2.0'
const V2_INDY_PRESENTATION = 'hlindy/proof@v2.0'
const V1_PROOF = 'v1_proof'

const LD_ATTACH_ID = '...'
const LD_PROPOSE_FORMAT = '...'
const LD_REQUEST_FORMAT = '...'

const V2IndyProposeProofFormat: ProofFormatSpec = {
  attachmentId: INDY_ATTACH_ID,
  format: V2_INDY_PRESENTATION_PROPOSAL,
}

const V2JsonLdProposeProofFormat: ProofFormatSpec = {
  attachmentId: LD_ATTACH_ID,
  format: LD_PROPOSE_FORMAT,
}

const V2IndyRequestProofFormat: ProofFormatSpec = {
  attachmentId: INDY_ATTACH_ID,
  format: V2_INDY_PRESENTATION_REQUEST,
}

const V2JsonLdRequestProofFormat: ProofFormatSpec = {
  attachmentId: LD_ATTACH_ID,
  format: LD_REQUEST_FORMAT,
}

const V2IndyProofFormat: ProofFormatSpec = {
  attachmentId: INDY_ATTACH_ID,
  format: V2_INDY_PRESENTATION,
}

const V2JsonLdProofFormat: ProofFormatSpec = {
  attachmentId: LD_ATTACH_ID,
  format: LD_REQUEST_FORMAT,
}

const V1IndyProofFormat: ProofFormatSpec = {
  attachmentId: INDY_ATTACH_ID,
  format: V1_PROOF,
}

export const ATTACHMENT_FORMAT: V2ProofAttachmentFormat = {
  V2_INDY_PRESENTATION_PROPOSAL: {
    indy: V2IndyProposeProofFormat,
    ldproof: V2JsonLdProposeProofFormat,
  },
  V2_INDY_PRESENTATION_REQUEST: {
    indy: V2IndyRequestProofFormat,
    ldproof: V2JsonLdRequestProofFormat,
  },
  V2_INDY_PRESENTATION: {
    indy: V2IndyProofFormat,
    ldproof: V2JsonLdProofFormat,
  },
  V1_PROOF: {
    indy: V1IndyProofFormat,
    ldproof: V1IndyProofFormat,
  },
}

// PK-TODO
// export const getFormatTypeByFormat = (format: string) => {
//   let type
//   for (const messageType in ATTACHMENT_FORMAT) {
//     const formatTypeArray = ATTACHMENT_FORMAT[messageType]

//     for (const formatType in formatTypeArray) {
//       const formatValue = formatTypeArray[formatType]

//       if (formatValue.format === format) {
//         type = formatType
//       }
//     }
//   }
//   return type
// }
