from enum import Enum


class PatchRevocationRegistryRevRegIdSetStateState(str, Enum):
    INIT = "init"
    GENERATED = "generated"
    POSTED = "posted"
    ACTIVE = "active"
    FULL = "full"

    def __str__(self) -> str:
        return str(self.value)
