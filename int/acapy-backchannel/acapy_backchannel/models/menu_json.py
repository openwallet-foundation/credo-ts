from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..models.menu_option import MenuOption
from ..types import UNSET, Unset

T = TypeVar("T", bound="MenuJson")


@attr.s(auto_attribs=True)
class MenuJson:
    """ """

    options: List[MenuOption]
    description: Union[Unset, str] = UNSET
    errormsg: Union[Unset, str] = UNSET
    title: Union[Unset, str] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        options = []
        for options_item_data in self.options:
            options_item = options_item_data.to_dict()

            options.append(options_item)

        description = self.description
        errormsg = self.errormsg
        title = self.title

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "options": options,
            }
        )
        if description is not UNSET:
            field_dict["description"] = description
        if errormsg is not UNSET:
            field_dict["errormsg"] = errormsg
        if title is not UNSET:
            field_dict["title"] = title

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        options = []
        _options = d.pop("options")
        for options_item_data in _options:
            options_item = MenuOption.from_dict(options_item_data)

            options.append(options_item)

        description = d.pop("description", UNSET)

        errormsg = d.pop("errormsg", UNSET)

        title = d.pop("title", UNSET)

        menu_json = cls(
            options=options,
            description=description,
            errormsg=errormsg,
            title=title,
        )

        menu_json.additional_properties = d
        return menu_json

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
