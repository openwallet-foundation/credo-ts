from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..types import UNSET, Unset

T = TypeVar("T", bound="IndyRequestedCredsRequestedPred")


@attr.s(auto_attribs=True)
class IndyRequestedCredsRequestedPred:
    """ """

    cred_id: str
    timestamp: Union[Unset, int] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        cred_id = self.cred_id
        timestamp = self.timestamp

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "cred_id": cred_id,
            }
        )
        if timestamp is not UNSET:
            field_dict["timestamp"] = timestamp

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        cred_id = d.pop("cred_id")

        timestamp = d.pop("timestamp", UNSET)

        indy_requested_creds_requested_pred = cls(
            cred_id=cred_id,
            timestamp=timestamp,
        )

        indy_requested_creds_requested_pred.additional_properties = d
        return indy_requested_creds_requested_pred

    @property
    def additional_keys(self) -> List[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
