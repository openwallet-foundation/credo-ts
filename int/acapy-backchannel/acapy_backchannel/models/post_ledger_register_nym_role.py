from enum import Enum


class PostLedgerRegisterNymRole(str, Enum):
    STEWARD = "STEWARD"
    TRUSTEE = "TRUSTEE"
    ENDORSER = "ENDORSER"
    NETWORK_MONITOR = "NETWORK_MONITOR"
    RESET = "reset"

    def __str__(self) -> str:
        return str(self.value)
