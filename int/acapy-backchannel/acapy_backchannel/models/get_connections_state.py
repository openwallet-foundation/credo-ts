from enum import Enum


class GetConnectionsState(str, Enum):
    START = "start"
    ERROR = "error"
    RESPONSE = "response"
    INIT = "init"
    ABANDONED = "abandoned"
    ACTIVE = "active"
    REQUEST = "request"
    INVITATION = "invitation"
    COMPLETED = "completed"

    def __str__(self) -> str:
        return str(self.value)
