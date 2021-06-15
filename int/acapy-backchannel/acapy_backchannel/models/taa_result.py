from typing import Any, Dict, List, Type, TypeVar

import attr

from ..models.taa_info import TAAInfo

T = TypeVar("T", bound="TAAResult")


@attr.s(auto_attribs=True)
class TAAResult:
    """ """

    result: TAAInfo
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        result = self.result.to_dict()

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "result": result,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        result = TAAInfo.from_dict(d.pop("result"))

        taa_result = cls(
            result=result,
        )

        taa_result.additional_properties = d
        return taa_result

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
