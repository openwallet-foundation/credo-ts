from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..models.menu_form import MenuForm
from ..types import UNSET, Unset

T = TypeVar("T", bound="MenuOption")


@attr.s(auto_attribs=True)
class MenuOption:
    """ """

    name: str
    title: str
    description: Union[Unset, str] = UNSET
    disabled: Union[Unset, bool] = UNSET
    form: Union[Unset, MenuForm] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        name = self.name
        title = self.title
        description = self.description
        disabled = self.disabled
        form: Union[Unset, Dict[str, Any]] = UNSET
        if not isinstance(self.form, Unset):
            form = self.form.to_dict()

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "name": name,
                "title": title,
            }
        )
        if description is not UNSET:
            field_dict["description"] = description
        if disabled is not UNSET:
            field_dict["disabled"] = disabled
        if form is not UNSET:
            field_dict["form"] = form

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        name = d.pop("name")

        title = d.pop("title")

        description = d.pop("description", UNSET)

        disabled = d.pop("disabled", UNSET)

        form: Union[Unset, MenuForm] = UNSET
        _form = d.pop("form", UNSET)
        if not isinstance(_form, Unset):
            form = MenuForm.from_dict(_form)

        menu_option = cls(
            name=name,
            title=title,
            description=description,
            disabled=disabled,
            form=form,
        )

        menu_option.additional_properties = d
        return menu_option

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
