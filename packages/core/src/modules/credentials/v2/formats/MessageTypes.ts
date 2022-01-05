interface AttachmentFormat {
    [id: string]: string
}


export const SPEC_URI: string = (
    "https://github.com/hyperledger/aries-rfcs/tree/cd27fc64aa2805f756a118043d7c880354353047/features/0453-issue-credential-v2"
)

// Message types
export const CRED_20_PROPOSAL: string = "https://didcomm.org/issue-credential/2.0/propose-credential"
export const CRED_20_OFFER: string = "https://didcomm.org/issue-credential/2.0/offer-credential"
export const CRED_20_REQUEST: string = "https://didcomm.org/issue-credential/2.0/request-credential"
export const CRED_20_ISSUE: string = "https://didcomm.org/issue-credential/2.0/issue-credential"
export const CRED_20_ACK: string = "https://didcomm.org/issue-credential/2.0/ack"
export const CRED_20_PROBLEM_REPORT: string = "https://didcomm.org/issue-credential/2.0/problem-report"

export const PROTOCOL_PACKAGE = "aries_cloudagent.protocols.issue_credential.v2_0"


