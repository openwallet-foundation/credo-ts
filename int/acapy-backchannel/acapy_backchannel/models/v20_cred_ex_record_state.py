from enum import Enum


class V20CredExRecordState(str, Enum):
    PROPOSAL_SENT = "proposal-sent"
    PROPOSAL_RECEIVED = "proposal-received"
    OFFER_SENT = "offer-sent"
    OFFER_RECEIVED = "offer-received"
    REQUEST_SENT = "request-sent"
    REQUEST_RECEIVED = "request-received"
    CREDENTIAL_ISSUED = "credential-issued"
    CREDENTIAL_RECEIVED = "credential-received"
    DONE = "done"

    def __str__(self) -> str:
        return str(self.value)
