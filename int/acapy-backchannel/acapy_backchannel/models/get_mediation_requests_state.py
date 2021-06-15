from enum import Enum


class GetMediationRequestsState(str, Enum):
    REQUEST = "request"
    GRANTED = "granted"
    DENIED = "denied"

    def __str__(self) -> str:
        return str(self.value)
