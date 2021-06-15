from enum import Enum


class AttachmentDefType(str, Enum):
    CREDENTIAL_OFFER = "credential-offer"
    PRESENT_PROOF = "present-proof"

    def __str__(self) -> str:
        return str(self.value)
