from enum import Enum


class V10CredentialExchangeRole(str, Enum):
    HOLDER = "holder"
    ISSUER = "issuer"

    def __str__(self) -> str:
        return str(self.value)
