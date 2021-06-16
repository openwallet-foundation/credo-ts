from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..models.schema import Schema
from ..types import UNSET, Unset

T = TypeVar("T", bound="SchemaGetResults")


@attr.s(auto_attribs=True)
class SchemaGetResults:
    """ """

    schema: Union[Unset, Schema] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        schema: Union[Unset, Dict[str, Any]] = UNSET
        if not isinstance(self.schema, Unset):
            schema = self.schema.to_dict()

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if schema is not UNSET:
            field_dict["schema"] = schema

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        schema: Union[Unset, Schema] = UNSET
        _schema = d.pop("schema", UNSET)
        if not isinstance(_schema, Unset):
            schema = Schema.from_dict(_schema)

        schema_get_results = cls(
            schema=schema,
        )

        schema_get_results.additional_properties = d
        return schema_get_results

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
