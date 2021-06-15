from typing import Any, Dict, List, Type, TypeVar

import attr

T = TypeVar("T", bound="AttachDecoratorDataJWSHeader")


@attr.s(auto_attribs=True)
class AttachDecoratorDataJWSHeader:
    """ """

    kid: str
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        kid = self.kid

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "kid": kid,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        kid = d.pop("kid")

        attach_decorator_data_jws_header = cls(
            kid=kid,
        )

        attach_decorator_data_jws_header.additional_properties = d
        return attach_decorator_data_jws_header

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
