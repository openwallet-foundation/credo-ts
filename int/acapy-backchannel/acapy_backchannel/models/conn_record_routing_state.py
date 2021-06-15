from enum import Enum


class ConnRecordRoutingState(str, Enum):
    NONE = "none"
    REQUEST = "request"
    ACTIVE = "active"
    ERROR = "error"

    def __str__(self) -> str:
        return str(self.value)
