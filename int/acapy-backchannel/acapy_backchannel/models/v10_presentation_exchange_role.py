from enum import Enum


class V10PresentationExchangeRole(str, Enum):
    PROVER = "prover"
    VERIFIER = "verifier"

    def __str__(self) -> str:
        return str(self.value)
