from datetime import datetime, timedelta, timezone
from typing import Annotated
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from .config import settings
from .db import get_db
from .models import User

hasher = PasswordHasher()
bearer = HTTPBearer(auto_error=False)
Db = Annotated[Session, Depends(get_db)]
DUMMY_HASH = hasher.hash('dummy-password-for-timing-only')


def verify_password(encoded, password):
    try:
        return hasher.verify(encoded, password)
    except (VerificationError, InvalidHashError):
        return False


def issue_token(user):
    now = datetime.now(timezone.utc)
    return jwt.encode({'sub': str(user.id), 'ver': user.token_version, 'iat': now,
                       'exp': now + timedelta(minutes=settings.access_token_minutes),
                       'iss': 'haven-pms', 'aud': 'haven-web'}, settings.jwt_secret, algorithm='HS256')


def current_user(db: Db, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]):
    denied = HTTPException(401, 'Please sign in again.', headers={'WWW-Authenticate': 'Bearer'})
    if not credentials:
        raise denied
    try:
        claims = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=['HS256'],
                            audience='haven-web', issuer='haven-pms', options={'require': ['sub', 'exp', 'iat', 'ver']})
        user = db.get(User, int(claims['sub']))
    except (jwt.InvalidTokenError, ValueError, KeyError):
        raise denied
    if not user or not user.is_active or claims['ver'] != user.token_version:
        raise denied
    return user


Current = Annotated[User, Depends(current_user)]


def require(*roles):
    def dependency(user: Current):
        if user.role not in roles:
            raise HTTPException(403, 'You do not have permission to perform this action.')
        return user
    return dependency


FrontDesk = Annotated[User, Depends(require('Admin', 'Receptionist'))]
Admin = Annotated[User, Depends(require('Admin'))]
Housekeeper = Annotated[User, Depends(require('Housekeeping'))]
Booker = Annotated[User, Depends(require('Guest', 'Admin', 'Receptionist'))]
Staff = Annotated[User, Depends(require('Admin', 'Receptionist', 'Housekeeping'))]
