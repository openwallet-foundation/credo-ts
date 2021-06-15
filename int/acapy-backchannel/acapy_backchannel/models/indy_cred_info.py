from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..models.indy_cred_info_attrs import IndyCredInfoAttrs
from ..types import UNSET, Unset

T = TypeVar("T", bound="IndyCredInfo")


@attr.s(auto_attribs=True)
class IndyCredInfo:
    """ """

    attrs: Union[Unset, IndyCredInfoAttrs] = UNSET
    referent: Union[Unset, str] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        attrs: Union[Unset, Dict[str, Any]] = UNSET
        if not isinstance(self.attrs, Unset):
            attrs = self.attrs.to_dict()

        referent = self.referent

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if attrs is not UNSET:
            field_dict["attrs"] = attrs
        if referent is not UNSET:
            field_dict["referent"] = referent

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        attrs: Union[Unset, IndyCredInfoAttrs] = UNSET
        _attrs = d.pop("attrs", UNSET)
        if not isinstance(_attrs, Unset):
            attrs = IndyCredInfoAttrs.from_dict(_attrs)

        referent = d.pop("referent", UNSET)

        indy_cred_info = cls(
            attrs=attrs,
            referent=referent,
        )

        indy_cred_info.additional_properties = d
        return indy_cred_info

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
