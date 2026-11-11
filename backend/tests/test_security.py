from datetime import datetime, timedelta, timezone

import jwt
import pytest

from app.config import settings


@pytest.mark.parametrize('case', ['expired', 'wrong-audience', 'wrong-signature', 'malformed'])
def test_invalid_access_tokens_are_rejected(client, fixture, case):
    now = datetime.now(timezone.utc)
    claims = {
        'sub': str(fixture['users']['admin']),
        'ver': 0,
        'iat': now - timedelta(minutes=10),
        'exp': now + timedelta(minutes=10),
        'iss': 'haven-pms',
        'aud': 'haven-web',
    }
    secret = settings.jwt_secret
    if case == 'expired':
        claims['exp'] = now - timedelta(seconds=1)
    elif case == 'wrong-audience':
        claims['aud'] = 'another-app'
    elif case == 'wrong-signature':
        secret = 'untrusted-test-key-with-at-least-32-characters'
    token = 'invalid.jwt.value' if case == 'malformed' else jwt.encode(claims, secret, algorithm='HS256')
    response = client.get('/api/users', headers={'Authorization': 'Bearer ' + token})
    assert response.status_code == 401
    assert response.json()['detail'] == 'Please sign in again.'
