from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..models.keylist_update_rule import KeylistUpdateRule
from ..types import UNSET, Unset

T = TypeVar("T", bound="KeylistUpdateRequest")


@attr.s(auto_attribs=True)
class KeylistUpdateRequest:
    """ """

    updates: Union[Unset, List[KeylistUpdateRule]] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        updates: Union[Unset, List[Dict[str, Any]]] = UNSET
        if not isinstance(self.updates, Unset):
            updates = []
            for updates_item_data in self.updates:
                updates_item = updates_item_data.to_dict()

                updates.append(updates_item)

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if updates is not UNSET:
            field_dict["updates"] = updates

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        updates = []
        _updates = d.pop("updates", UNSET)
        for updates_item_data in _updates or []:
            updates_item = KeylistUpdateRule.from_dict(updates_item_data)

            updates.append(updates_item)

        keylist_update_request = cls(
            updates=updates,
        )

        keylist_update_request.additional_properties = d
        return keylist_update_request

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
