from enum import Enum


class V20CredExRecordInitiator(str, Enum):
    SELF = "self"
    EXTERNAL = "external"

    def __str__(self) -> str:
        return str(self.value)
