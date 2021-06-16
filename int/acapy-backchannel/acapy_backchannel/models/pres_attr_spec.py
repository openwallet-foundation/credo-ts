from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..types import UNSET, Unset

T = TypeVar("T", bound="PresAttrSpec")


@attr.s(auto_attribs=True)
class PresAttrSpec:
    """ """

    name: str
    cred_def_id: Union[Unset, str] = UNSET
    mime_type: Union[Unset, str] = UNSET
    referent: Union[Unset, str] = UNSET
    value: Union[Unset, str] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        name = self.name
        cred_def_id = self.cred_def_id
        mime_type = self.mime_type
        referent = self.referent
        value = self.value

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "name": name,
            }
        )
        if cred_def_id is not UNSET:
            field_dict["cred_def_id"] = cred_def_id
        if mime_type is not UNSET:
            field_dict["mime-type"] = mime_type
        if referent is not UNSET:
            field_dict["referent"] = referent
        if value is not UNSET:
            field_dict["value"] = value

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        name = d.pop("name")

        cred_def_id = d.pop("cred_def_id", UNSET)

        mime_type = d.pop("mime-type", UNSET)

        referent = d.pop("referent", UNSET)

        value = d.pop("value", UNSET)

        pres_attr_spec = cls(
            name=name,
            cred_def_id=cred_def_id,
            mime_type=mime_type,
            referent=referent,
            value=value,
        )

        pres_attr_spec.additional_properties = d
        return pres_attr_spec

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
