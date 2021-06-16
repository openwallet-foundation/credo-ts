from typing import Any, Dict, List, Type, TypeVar, Union, cast

import attr

from ..types import UNSET, Unset

T = TypeVar("T", bound="Schema")


@attr.s(auto_attribs=True)
class Schema:
    """ """

    attr_names: Union[Unset, List[str]] = UNSET
    id: Union[Unset, str] = UNSET
    name: Union[Unset, str] = UNSET
    seq_no: Union[Unset, int] = UNSET
    ver: Union[Unset, str] = UNSET
    version: Union[Unset, str] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        attr_names: Union[Unset, List[str]] = UNSET
        if not isinstance(self.attr_names, Unset):
            attr_names = self.attr_names

        id = self.id
        name = self.name
        seq_no = self.seq_no
        ver = self.ver
        version = self.version

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if attr_names is not UNSET:
            field_dict["attrNames"] = attr_names
        if id is not UNSET:
            field_dict["id"] = id
        if name is not UNSET:
            field_dict["name"] = name
        if seq_no is not UNSET:
            field_dict["seqNo"] = seq_no
        if ver is not UNSET:
            field_dict["ver"] = ver
        if version is not UNSET:
            field_dict["version"] = version

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        attr_names = cast(List[str], d.pop("attrNames", UNSET))

        id = d.pop("id", UNSET)

        name = d.pop("name", UNSET)

        seq_no = d.pop("seqNo", UNSET)

        ver = d.pop("ver", UNSET)

        version = d.pop("version", UNSET)

        schema = cls(
            attr_names=attr_names,
            id=id,
            name=name,
            seq_no=seq_no,
            ver=ver,
            version=version,
        )

        schema.additional_properties = d
        return schema

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
