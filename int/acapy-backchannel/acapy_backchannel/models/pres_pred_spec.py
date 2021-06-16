from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..models.pres_pred_spec_predicate import PresPredSpecPredicate
from ..types import UNSET, Unset

T = TypeVar("T", bound="PresPredSpec")


@attr.s(auto_attribs=True)
class PresPredSpec:
    """ """

    name: str
    predicate: PresPredSpecPredicate
    threshold: int
    cred_def_id: Union[Unset, str] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        name = self.name
        predicate = self.predicate.value

        threshold = self.threshold
        cred_def_id = self.cred_def_id

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "name": name,
                "predicate": predicate,
                "threshold": threshold,
            }
        )
        if cred_def_id is not UNSET:
            field_dict["cred_def_id"] = cred_def_id

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        name = d.pop("name")

        predicate = PresPredSpecPredicate(d.pop("predicate"))

        threshold = d.pop("threshold")

        cred_def_id = d.pop("cred_def_id", UNSET)

        pres_pred_spec = cls(
            name=name,
            predicate=predicate,
            threshold=threshold,
            cred_def_id=cred_def_id,
        )

        pres_pred_spec.additional_properties = d
        return pres_pred_spec

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
