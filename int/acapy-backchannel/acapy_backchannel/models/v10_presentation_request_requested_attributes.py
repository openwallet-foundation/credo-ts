from typing import Any, Dict, List, Type, TypeVar

import attr

from ..models.indy_requested_creds_requested_attr import IndyRequestedCredsRequestedAttr

T = TypeVar("T", bound="V10PresentationRequestRequestedAttributes")


@attr.s(auto_attribs=True)
class V10PresentationRequestRequestedAttributes:
    """Nested object mapping proof request attribute referents to requested-attribute specifiers"""

    additional_properties: Dict[str, IndyRequestedCredsRequestedAttr] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:

        field_dict: Dict[str, Any] = {}
        for prop_name, prop in self.additional_properties.items():
            field_dict[prop_name] = prop.to_dict()

        field_dict.update({})

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        v10_presentation_request_requested_attributes = cls()

        additional_properties = {}
        for prop_name, prop_dict in d.items():
            additional_property = IndyRequestedCredsRequestedAttr.from_dict(prop_dict)

            additional_properties[prop_name] = additional_property

        v10_presentation_request_requested_attributes.additional_properties = additional_properties
        return v10_presentation_request_requested_attributes

    @property
    def additional_keys(self) -> List[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> IndyRequestedCredsRequestedAttr:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: IndyRequestedCredsRequestedAttr) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
