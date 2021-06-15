from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..models.indy_proof_req_non_revoked import IndyProofReqNonRevoked
from ..models.indy_proof_req_pred_spec_p_type import IndyProofReqPredSpecPType
from ..models.indy_proof_req_pred_spec_restrictions import IndyProofReqPredSpecRestrictions
from ..types import UNSET, Unset

T = TypeVar("T", bound="IndyProofReqPredSpec")


@attr.s(auto_attribs=True)
class IndyProofReqPredSpec:
    """ """

    name: str
    p_type: IndyProofReqPredSpecPType
    p_value: int
    non_revoked: Union[Unset, IndyProofReqNonRevoked] = UNSET
    restrictions: Union[Unset, List[IndyProofReqPredSpecRestrictions]] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        name = self.name
        p_type = self.p_type.value

        p_value = self.p_value
        non_revoked: Union[Unset, Dict[str, Any]] = UNSET
        if not isinstance(self.non_revoked, Unset):
            non_revoked = self.non_revoked.to_dict()

        restrictions: Union[Unset, List[Dict[str, Any]]] = UNSET
        if not isinstance(self.restrictions, Unset):
            restrictions = []
            for restrictions_item_data in self.restrictions:
                restrictions_item = restrictions_item_data.to_dict()

                restrictions.append(restrictions_item)

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "name": name,
                "p_type": p_type,
                "p_value": p_value,
            }
        )
        if non_revoked is not UNSET:
            field_dict["non_revoked"] = non_revoked
        if restrictions is not UNSET:
            field_dict["restrictions"] = restrictions

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        name = d.pop("name")

        p_type = IndyProofReqPredSpecPType(d.pop("p_type"))

        p_value = d.pop("p_value")

        non_revoked: Union[Unset, IndyProofReqNonRevoked] = UNSET
        _non_revoked = d.pop("non_revoked", UNSET)
        if not isinstance(_non_revoked, Unset):
            non_revoked = IndyProofReqNonRevoked.from_dict(_non_revoked)

        restrictions = []
        _restrictions = d.pop("restrictions", UNSET)
        for restrictions_item_data in _restrictions or []:
            restrictions_item = IndyProofReqPredSpecRestrictions.from_dict(restrictions_item_data)

            restrictions.append(restrictions_item)

        indy_proof_req_pred_spec = cls(
            name=name,
            p_type=p_type,
            p_value=p_value,
            non_revoked=non_revoked,
            restrictions=restrictions,
        )

        indy_proof_req_pred_spec.additional_properties = d
        return indy_proof_req_pred_spec

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
