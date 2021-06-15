from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..models.keylist_query_filter_request_filter import KeylistQueryFilterRequestFilter
from ..types import UNSET, Unset

T = TypeVar("T", bound="KeylistQueryFilterRequest")


@attr.s(auto_attribs=True)
class KeylistQueryFilterRequest:
    """ """

    filter_: Union[Unset, KeylistQueryFilterRequestFilter] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        filter_: Union[Unset, Dict[str, Any]] = UNSET
        if not isinstance(self.filter_, Unset):
            filter_ = self.filter_.to_dict()

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if filter_ is not UNSET:
            field_dict["filter"] = filter_

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        filter_: Union[Unset, KeylistQueryFilterRequestFilter] = UNSET
        _filter_ = d.pop("filter", UNSET)
        if not isinstance(_filter_, Unset):
            filter_ = KeylistQueryFilterRequestFilter.from_dict(_filter_)

        keylist_query_filter_request = cls(
            filter_=filter_,
        )

        keylist_query_filter_request.additional_properties = d
        return keylist_query_filter_request

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
