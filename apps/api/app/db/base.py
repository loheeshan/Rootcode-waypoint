from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Import domain models into migrations/env.py before generating migrations."""
