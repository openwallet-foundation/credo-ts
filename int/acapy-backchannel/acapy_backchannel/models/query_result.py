from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..models.query_result_results import QueryResultResults
from ..types import UNSET, Unset

T = TypeVar("T", bound="QueryResult")


@attr.s(auto_attribs=True)
class QueryResult:
    """ """

    results: Union[Unset, QueryResultResults] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        results: Union[Unset, Dict[str, Any]] = UNSET
        if not isinstance(self.results, Unset):
            results = self.results.to_dict()

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if results is not UNSET:
            field_dict["results"] = results

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        results: Union[Unset, QueryResultResults] = UNSET
        _results = d.pop("results", UNSET)
        if not isinstance(_results, Unset):
            results = QueryResultResults.from_dict(_results)

        query_result = cls(
            results=results,
        )

        query_result.additional_properties = d
        return query_result

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
