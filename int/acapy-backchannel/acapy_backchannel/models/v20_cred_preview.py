from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..models.v20_cred_attr_spec import V20CredAttrSpec
from ..types import UNSET, Unset

T = TypeVar("T", bound="V20CredPreview")


@attr.s(auto_attribs=True)
class V20CredPreview:
    """ """

    attributes: List[V20CredAttrSpec]
    type: Union[Unset, str] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        attributes = []
        for attributes_item_data in self.attributes:
            attributes_item = attributes_item_data.to_dict()

            attributes.append(attributes_item)

        type = self.type

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "attributes": attributes,
            }
        )
        if type is not UNSET:
            field_dict["@type"] = type

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        attributes = []
        _attributes = d.pop("attributes")
        for attributes_item_data in _attributes:
            attributes_item = V20CredAttrSpec.from_dict(attributes_item_data)

            attributes.append(attributes_item)

        type = d.pop("@type", UNSET)

        v20_cred_preview = cls(
            attributes=attributes,
            type=type,
        )

        v20_cred_preview.additional_properties = d
        return v20_cred_preview

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
