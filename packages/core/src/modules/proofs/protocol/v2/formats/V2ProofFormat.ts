export type V2ProofFormatSpec = {
  attachId: string
  format: string
}

type V2ProofAttachmentFormat = {
  [id: string]: {
    indy: V2ProofFormatSpec
    ldproof: V2ProofFormatSpec
  }
}

const INDY_ATTACH_ID = 'indy'
const PRES_20_PROPOSAL = 'hlindy/proof-req@v2.0'
const PRES_20_REQUEST = 'hlindy/proof-req@v2.0'
const PRES_20_PROOF = 'hlindy/proof@v2.0'

const LD_ATTACH_ID = '...' // MJR-TODO
const LD_PROPOSE_FORMAT = '...' // MJR-TODO
const LD_REQUEST_FORMAT = '...' // TODO

const V2IndyProposeProofFormat: V2ProofFormatSpec = {
  attachId: INDY_ATTACH_ID,
  format: PRES_20_PROPOSAL,
}

const V2JsonLdProposeProofFormat: V2ProofFormatSpec = {
  attachId: LD_ATTACH_ID,
  format: LD_PROPOSE_FORMAT,
}

const V2IndyRequestProofFormat: V2ProofFormatSpec = {
  attachId: INDY_ATTACH_ID,
  format: PRES_20_REQUEST,
}

const V2JsonLdRequestProofFormat: V2ProofFormatSpec = {
  attachId: LD_ATTACH_ID,
  format: LD_REQUEST_FORMAT,
}

const V2IndyProofFormat: V2ProofFormatSpec = {
  attachId: INDY_ATTACH_ID,
  format: PRES_20_PROOF,
}

const V2JsonLdProofFormat: V2ProofFormatSpec = {
  attachId: LD_ATTACH_ID,
  format: LD_REQUEST_FORMAT,
}

export const ATTACHMENT_FORMAT: V2ProofAttachmentFormat = {
  PRES_20_PROPOSAL: {
    indy: V2IndyProposeProofFormat,
    ldproof: V2JsonLdProposeProofFormat,
  },
  PRES_20_REQUEST: {
    indy: V2IndyRequestProofFormat,
    ldproof: V2JsonLdRequestProofFormat,
  },
  PRES_20_PROOF: {
    indy: V2IndyProofFormat,
    ldproof: V2JsonLdProofFormat,
  },

  // MJR-TODO
  // CRED_20_REQUEST: {
  //     V20CredFormat.Format.Indy.api: "hlindy/cred-req@v2.0",
  //     V20CredFormat.Format.LD_PROOF.api: "aries/ld-proof-vc-detail@v1.0",
  // },
  // CRED_20_ISSUE: {
  //     V20CredFormat.Format.Indy.api: "hlindy/cred@v2.0",
  //     V20CredFormat.Format.LD_PROOF.api: "aries/ld-proof-vc@v1.0",
  // },
}
