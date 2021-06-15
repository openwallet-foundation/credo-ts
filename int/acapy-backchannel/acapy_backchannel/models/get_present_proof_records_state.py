from enum import Enum


class GetPresentProofRecordsState(str, Enum):
    PROPOSAL_SENT = "proposal_sent"
    PROPOSAL_RECEIVED = "proposal_received"
    REQUEST_SENT = "request_sent"
    REQUEST_RECEIVED = "request_received"
    PRESENTATION_SENT = "presentation_sent"
    PRESENTATION_RECEIVED = "presentation_received"
    VERIFIED = "verified"
    PRESENTATION_ACKED = "presentation_acked"

    def __str__(self) -> str:
        return str(self.value)
