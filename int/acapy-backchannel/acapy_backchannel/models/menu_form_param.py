from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..types import UNSET, Unset

T = TypeVar("T", bound="MenuFormParam")


@attr.s(auto_attribs=True)
class MenuFormParam:
    """ """

    name: str
    title: str
    default: Union[Unset, str] = UNSET
    description: Union[Unset, str] = UNSET
    required: Union[Unset, bool] = UNSET
    type: Union[Unset, str] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        name = self.name
        title = self.title
        default = self.default
        description = self.description
        required = self.required
        type = self.type

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "name": name,
                "title": title,
            }
        )
        if default is not UNSET:
            field_dict["default"] = default
        if description is not UNSET:
            field_dict["description"] = description
        if required is not UNSET:
            field_dict["required"] = required
        if type is not UNSET:
            field_dict["type"] = type

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        name = d.pop("name")

        title = d.pop("title")

        default = d.pop("default", UNSET)

        description = d.pop("description", UNSET)

        required = d.pop("required", UNSET)

        type = d.pop("type", UNSET)

        menu_form_param = cls(
            name=name,
            title=title,
            default=default,
            description=description,
            required=required,
            type=type,
        )

        menu_form_param.additional_properties = d
        return menu_form_param

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
