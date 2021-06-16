from enum import Enum


class GetWalletDidPosture(str, Enum):
    PUBLIC = "public"
    POSTED = "posted"
    WALLET_ONLY = "wallet_only"

    def __str__(self) -> str:
        return str(self.value)
