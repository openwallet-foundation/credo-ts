from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..models.clear_pending_revocations_request_purge import ClearPendingRevocationsRequestPurge
from ..types import UNSET, Unset

T = TypeVar("T", bound="ClearPendingRevocationsRequest")


@attr.s(auto_attribs=True)
class ClearPendingRevocationsRequest:
    """ """

    purge: Union[Unset, ClearPendingRevocationsRequestPurge] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        purge: Union[Unset, Dict[str, Any]] = UNSET
        if not isinstance(self.purge, Unset):
            purge = self.purge.to_dict()

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if purge is not UNSET:
            field_dict["purge"] = purge

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        purge: Union[Unset, ClearPendingRevocationsRequestPurge] = UNSET
        _purge = d.pop("purge", UNSET)
        if not isinstance(_purge, Unset):
            purge = ClearPendingRevocationsRequestPurge.from_dict(_purge)

        clear_pending_revocations_request = cls(
            purge=purge,
        )

        clear_pending_revocations_request.additional_properties = d
        return clear_pending_revocations_request

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
