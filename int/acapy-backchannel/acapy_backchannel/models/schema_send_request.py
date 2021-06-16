from typing import Any, Dict, List, Type, TypeVar, cast

import attr

T = TypeVar("T", bound="SchemaSendRequest")


@attr.s(auto_attribs=True)
class SchemaSendRequest:
    """ """

    attributes: List[str]
    schema_name: str
    schema_version: str
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        attributes = self.attributes

        schema_name = self.schema_name
        schema_version = self.schema_version

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "attributes": attributes,
                "schema_name": schema_name,
                "schema_version": schema_version,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        attributes = cast(List[str], d.pop("attributes"))

        schema_name = d.pop("schema_name")

        schema_version = d.pop("schema_version")

        schema_send_request = cls(
            attributes=attributes,
            schema_name=schema_name,
            schema_version=schema_version,
        )

        schema_send_request.additional_properties = d
        return schema_send_request

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
