from enum import Enum


class GetIssueCredentialRecordsRole(str, Enum):
    ISSUER = "issuer"
    HOLDER = "holder"

    def __str__(self) -> str:
        return str(self.value)
