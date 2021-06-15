from typing import Any, Dict, List, Type, TypeVar, Union, cast

import attr

from ..types import UNSET, Unset

T = TypeVar("T", bound="SchemasCreatedResults")


@attr.s(auto_attribs=True)
class SchemasCreatedResults:
    """ """

    schema_ids: Union[Unset, List[str]] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        schema_ids: Union[Unset, List[str]] = UNSET
        if not isinstance(self.schema_ids, Unset):
            schema_ids = self.schema_ids

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if schema_ids is not UNSET:
            field_dict["schema_ids"] = schema_ids

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        schema_ids = cast(List[str], d.pop("schema_ids", UNSET))

        schemas_created_results = cls(
            schema_ids=schema_ids,
        )

        schemas_created_results.additional_properties = d
        return schemas_created_results

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
