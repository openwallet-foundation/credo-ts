from enum import Enum


class GetPresentProofRecordsRole(str, Enum):
    PROVER = "prover"
    VERIFIER = "verifier"

    def __str__(self) -> str:
        return str(self.value)
