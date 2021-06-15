from enum import Enum


class ConnRecordInvitationMode(str, Enum):
    ONCE = "once"
    MULTI = "multi"
    STATIC = "static"

    def __str__(self) -> str:
        return str(self.value)
