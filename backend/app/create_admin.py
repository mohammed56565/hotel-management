"""Bootstrap an administrator without a hardcoded production password."""
import getpass
from sqlalchemy import select
from .db import SessionLocal
from .models import User
from .schemas import Register
from .security import hasher


def main():
    account = Register(name=input('Full name: '), email=input('Email: '), password=getpass.getpass('Password (10+ characters, letters and numbers): '))
    with SessionLocal.begin() as db:
        if db.scalar(select(User).where(User.email == account.email)):
            raise SystemExit('That email is already registered.')
        db.add(User(name=account.name, email=account.email, password_hash=hasher.hash(account.password), role='Admin'))
    print('Administrator created.')


if __name__ == '__main__':
    main()
