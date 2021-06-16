from typing import Any, Dict, List, Type, TypeVar, Union

import attr

from ..models.v20_cred_ex_record_cred_issue import V20CredExRecordCredIssue
from ..models.v20_cred_ex_record_cred_offer import V20CredExRecordCredOffer
from ..models.v20_cred_ex_record_cred_preview import V20CredExRecordCredPreview
from ..models.v20_cred_ex_record_cred_proposal import V20CredExRecordCredProposal
from ..models.v20_cred_ex_record_cred_request import V20CredExRecordCredRequest
from ..models.v20_cred_ex_record_cred_request_metadata import V20CredExRecordCredRequestMetadata
from ..models.v20_cred_ex_record_initiator import V20CredExRecordInitiator
from ..models.v20_cred_ex_record_role import V20CredExRecordRole
from ..models.v20_cred_ex_record_state import V20CredExRecordState
from ..types import UNSET, Unset

T = TypeVar("T", bound="V20CredExRecord")


@attr.s(auto_attribs=True)
class V20CredExRecord:
    """ """

    auto_issue: Union[Unset, bool] = UNSET
    auto_offer: Union[Unset, bool] = UNSET
    auto_remove: Union[Unset, bool] = UNSET
    conn_id: Union[Unset, str] = UNSET
    created_at: Union[Unset, str] = UNSET
    cred_ex_id: Union[Unset, str] = UNSET
    cred_id_stored: Union[Unset, str] = UNSET
    cred_issue: Union[Unset, V20CredExRecordCredIssue] = UNSET
    cred_offer: Union[Unset, V20CredExRecordCredOffer] = UNSET
    cred_preview: Union[Unset, V20CredExRecordCredPreview] = UNSET
    cred_proposal: Union[Unset, V20CredExRecordCredProposal] = UNSET
    cred_request: Union[Unset, V20CredExRecordCredRequest] = UNSET
    cred_request_metadata: Union[Unset, V20CredExRecordCredRequestMetadata] = UNSET
    error_msg: Union[Unset, str] = UNSET
    initiator: Union[Unset, V20CredExRecordInitiator] = UNSET
    parent_thread_id: Union[Unset, str] = UNSET
    role: Union[Unset, V20CredExRecordRole] = UNSET
    state: Union[Unset, V20CredExRecordState] = UNSET
    thread_id: Union[Unset, str] = UNSET
    trace: Union[Unset, bool] = UNSET
    updated_at: Union[Unset, str] = UNSET
    additional_properties: Dict[str, Any] = attr.ib(init=False, factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        auto_issue = self.auto_issue
        auto_offer = self.auto_offer
        auto_remove = self.auto_remove
        conn_id = self.conn_id
        created_at = self.created_at
        cred_ex_id = self.cred_ex_id
        cred_id_stored = self.cred_id_stored
        cred_issue: Union[Unset, Dict[str, Any]] = UNSET
        if not isinstance(self.cred_issue, Unset):
            cred_issue = self.cred_issue.to_dict()

        cred_offer: Union[Unset, Dict[str, Any]] = UNSET
        if not isinstance(self.cred_offer, Unset):
            cred_offer = self.cred_offer.to_dict()

        cred_preview: Union[Unset, Dict[str, Any]] = UNSET
        if not isinstance(self.cred_preview, Unset):
            cred_preview = self.cred_preview.to_dict()

        cred_proposal: Union[Unset, Dict[str, Any]] = UNSET
        if not isinstance(self.cred_proposal, Unset):
            cred_proposal = self.cred_proposal.to_dict()

        cred_request: Union[Unset, Dict[str, Any]] = UNSET
        if not isinstance(self.cred_request, Unset):
            cred_request = self.cred_request.to_dict()

        cred_request_metadata: Union[Unset, Dict[str, Any]] = UNSET
        if not isinstance(self.cred_request_metadata, Unset):
            cred_request_metadata = self.cred_request_metadata.to_dict()

        error_msg = self.error_msg
        initiator: Union[Unset, str] = UNSET
        if not isinstance(self.initiator, Unset):
            initiator = self.initiator.value

        parent_thread_id = self.parent_thread_id
        role: Union[Unset, str] = UNSET
        if not isinstance(self.role, Unset):
            role = self.role.value

        state: Union[Unset, str] = UNSET
        if not isinstance(self.state, Unset):
            state = self.state.value

        thread_id = self.thread_id
        trace = self.trace
        updated_at = self.updated_at

        field_dict: Dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if auto_issue is not UNSET:
            field_dict["auto_issue"] = auto_issue
        if auto_offer is not UNSET:
            field_dict["auto_offer"] = auto_offer
        if auto_remove is not UNSET:
            field_dict["auto_remove"] = auto_remove
        if conn_id is not UNSET:
            field_dict["conn_id"] = conn_id
        if created_at is not UNSET:
            field_dict["created_at"] = created_at
        if cred_ex_id is not UNSET:
            field_dict["cred_ex_id"] = cred_ex_id
        if cred_id_stored is not UNSET:
            field_dict["cred_id_stored"] = cred_id_stored
        if cred_issue is not UNSET:
            field_dict["cred_issue"] = cred_issue
        if cred_offer is not UNSET:
            field_dict["cred_offer"] = cred_offer
        if cred_preview is not UNSET:
            field_dict["cred_preview"] = cred_preview
        if cred_proposal is not UNSET:
            field_dict["cred_proposal"] = cred_proposal
        if cred_request is not UNSET:
            field_dict["cred_request"] = cred_request
        if cred_request_metadata is not UNSET:
            field_dict["cred_request_metadata"] = cred_request_metadata
        if error_msg is not UNSET:
            field_dict["error_msg"] = error_msg
        if initiator is not UNSET:
            field_dict["initiator"] = initiator
        if parent_thread_id is not UNSET:
            field_dict["parent_thread_id"] = parent_thread_id
        if role is not UNSET:
            field_dict["role"] = role
        if state is not UNSET:
            field_dict["state"] = state
        if thread_id is not UNSET:
            field_dict["thread_id"] = thread_id
        if trace is not UNSET:
            field_dict["trace"] = trace
        if updated_at is not UNSET:
            field_dict["updated_at"] = updated_at

        return field_dict

    @classmethod
    def from_dict(cls: Type[T], src_dict: Dict[str, Any]) -> T:
        d = src_dict.copy()
        auto_issue = d.pop("auto_issue", UNSET)

        auto_offer = d.pop("auto_offer", UNSET)

        auto_remove = d.pop("auto_remove", UNSET)

        conn_id = d.pop("conn_id", UNSET)

        created_at = d.pop("created_at", UNSET)

        cred_ex_id = d.pop("cred_ex_id", UNSET)

        cred_id_stored = d.pop("cred_id_stored", UNSET)

        cred_issue: Union[Unset, V20CredExRecordCredIssue] = UNSET
        _cred_issue = d.pop("cred_issue", UNSET)
        if not isinstance(_cred_issue, Unset):
            cred_issue = V20CredExRecordCredIssue.from_dict(_cred_issue)

        cred_offer: Union[Unset, V20CredExRecordCredOffer] = UNSET
        _cred_offer = d.pop("cred_offer", UNSET)
        if not isinstance(_cred_offer, Unset):
            cred_offer = V20CredExRecordCredOffer.from_dict(_cred_offer)

        cred_preview: Union[Unset, V20CredExRecordCredPreview] = UNSET
        _cred_preview = d.pop("cred_preview", UNSET)
        if not isinstance(_cred_preview, Unset):
            cred_preview = V20CredExRecordCredPreview.from_dict(_cred_preview)

        cred_proposal: Union[Unset, V20CredExRecordCredProposal] = UNSET
        _cred_proposal = d.pop("cred_proposal", UNSET)
        if not isinstance(_cred_proposal, Unset):
            cred_proposal = V20CredExRecordCredProposal.from_dict(_cred_proposal)

        cred_request: Union[Unset, V20CredExRecordCredRequest] = UNSET
        _cred_request = d.pop("cred_request", UNSET)
        if not isinstance(_cred_request, Unset):
            cred_request = V20CredExRecordCredRequest.from_dict(_cred_request)

        cred_request_metadata: Union[Unset, V20CredExRecordCredRequestMetadata] = UNSET
        _cred_request_metadata = d.pop("cred_request_metadata", UNSET)
        if not isinstance(_cred_request_metadata, Unset):
            cred_request_metadata = V20CredExRecordCredRequestMetadata.from_dict(_cred_request_metadata)

        error_msg = d.pop("error_msg", UNSET)

        initiator: Union[Unset, V20CredExRecordInitiator] = UNSET
        _initiator = d.pop("initiator", UNSET)
        if not isinstance(_initiator, Unset):
            initiator = V20CredExRecordInitiator(_initiator)

        parent_thread_id = d.pop("parent_thread_id", UNSET)

        role: Union[Unset, V20CredExRecordRole] = UNSET
        _role = d.pop("role", UNSET)
        if not isinstance(_role, Unset):
            role = V20CredExRecordRole(_role)

        state: Union[Unset, V20CredExRecordState] = UNSET
        _state = d.pop("state", UNSET)
        if not isinstance(_state, Unset):
            state = V20CredExRecordState(_state)

        thread_id = d.pop("thread_id", UNSET)

        trace = d.pop("trace", UNSET)

        updated_at = d.pop("updated_at", UNSET)

        v20_cred_ex_record = cls(
            auto_issue=auto_issue,
            auto_offer=auto_offer,
            auto_remove=auto_remove,
            conn_id=conn_id,
            created_at=created_at,
            cred_ex_id=cred_ex_id,
            cred_id_stored=cred_id_stored,
            cred_issue=cred_issue,
            cred_offer=cred_offer,
            cred_preview=cred_preview,
            cred_proposal=cred_proposal,
            cred_request=cred_request,
            cred_request_metadata=cred_request_metadata,
            error_msg=error_msg,
            initiator=initiator,
            parent_thread_id=parent_thread_id,
            role=role,
            state=state,
            thread_id=thread_id,
            trace=trace,
            updated_at=updated_at,
        )

        v20_cred_ex_record.additional_properties = d
        return v20_cred_ex_record

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
