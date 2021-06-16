from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..models.attachment_def_type import AttachmentDefType
from ..types import UNSET, Unset

T = TypeVar("T", bound="AttachmentDef")


@attr.s(auto_attribs=True)
class AttachmentDef:
    """ """

    id: Union[Unset, str] = UNSET
    type: Union[Unset, AttachmentDefType] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        id = self.id
        type: Union[Unset, str] = UNSET
        if not isinstance(self.type, Unset):
            type = self.type.value

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if id is not UNSET:
            field_dict["id"] = id
        if type is not UNSET:
            field_dict["type"] = type

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        id = d.pop("id", UNSET)

        type: Union[Unset, AttachmentDefType] = UNSET
        _type = d.pop("type", UNSET)
        if not isinstance(_type, Unset):
            type = AttachmentDefType(_type)

        attachment_def = cls(
            id=id,
            type=type,
        )

        attachment_def.additional_properties = d
        return attachment_def

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
