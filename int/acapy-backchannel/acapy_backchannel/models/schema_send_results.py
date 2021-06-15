from typing import Any, Dict, List, Type, TypeVar

import attr

from ..models.schema_send_results_schema import SchemaSendResultsSchema

T = TypeVar("T", bound="SchemaSendResults")


@attr.s(auto_attribs=True)
class SchemaSendResults:
    """ """

    schema: SchemaSendResultsSchema
    schema_id: str
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        schema = self.schema.to_dict()

        schema_id = self.schema_id

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "schema": schema,
                "schema_id": schema_id,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        schema = SchemaSendResultsSchema.from_dict(d.pop("schema"))

        schema_id = d.pop("schema_id")

        schema_send_results = cls(
            schema=schema,
            schema_id=schema_id,
        )

        schema_send_results.additional_properties = d
        return schema_send_results

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
