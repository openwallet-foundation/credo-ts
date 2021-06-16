from enum import Enum


class GetIssueCredentialRecordsState(str, Enum):
    PROPOSAL_SENT = "proposal_sent"
    PROPOSAL_RECEIVED = "proposal_received"
    OFFER_SENT = "offer_sent"
    OFFER_RECEIVED = "offer_received"
    REQUEST_SENT = "request_sent"
    REQUEST_RECEIVED = "request_received"
    CREDENTIAL_ISSUED = "credential_issued"
    CREDENTIAL_RECEIVED = "credential_received"
    CREDENTIAL_ACKED = "credential_acked"

    def __str__(self) -> str:
        return str(self.value)
