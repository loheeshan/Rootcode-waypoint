"""Commit helper letting a caller add rows to the same transaction as a domain change."""

from collections.abc import Callable

from pydantic import BaseModel
from sqlalchemy.orm import Session

# Receives the domain result after flush and before commit (e.g. to add a sync receipt).
BeforeCommit = Callable[[BaseModel], None]


def commit_with(session: Session, result: BaseModel, before_commit: BeforeCommit | None) -> None:
    if before_commit is not None:
        before_commit(result)
        session.flush()
    session.commit()
