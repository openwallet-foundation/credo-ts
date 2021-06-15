from enum import Enum


class ConnRecordAccept(str, Enum):
    MANUAL = "manual"
    AUTO = "auto"

    def __str__(self) -> str:
        return str(self.value)
