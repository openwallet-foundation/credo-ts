from enum import Enum


class GetIssueCredential20RecordsRole(str, Enum):
    ISSUER = "issuer"
    HOLDER = "holder"

    def __str__(self) -> str:
        return str(self.value)
