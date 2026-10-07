from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, time
from zoneinfo import ZoneInfo
import pytest
from sqlalchemy import select, text
from fastapi.testclient import TestClient
from app.db import engine, SessionLocal
from app.main import app
from app.models import HotelSettings, HousekeepingTask, Reservation, Room, RoomType, User
from app import services


def test_registration_and_duplicate(client, fixture):
    data = dict(name='New Guest',email='NEW@example.com',password='NewGuest123!')
    r = client.post('/api/auth/register',json=data)
    assert r.status_code == 201
    assert r.json()['user']['role'] == 'Guest'
    assert r.json()['user']['email'] == 'new@example.com'
    assert client.post('/api/auth/register',json=data).status_code == 409
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email=='new@example.com'))
        assert user.password_hash.startswith('$argon2') and user.password_hash != data['password']


@pytest.mark.parametrize('data',[
    dict(name='A',email='bad',password='short'),
    dict(name='Valid Name',email='valid@example.com',password='abcdefghijk'),
    dict(name='Valid Name',email='valid@example.com',password='12345678901'),
    dict(name='Valid Name',email='valid@example.com',password='GoodPassword12',role='Admin'),
])
def test_invalid_registration(client, fixture, data):
    assert client.post('/api/auth/register',json=data).status_code == 422


def test_login_logout_and_disabled(client, fixture, call):
    assert client.post('/api/auth/login',json={'email':'guest@example.com','password':'wrong'}).status_code == 401
    r = client.post('/api/auth/login',json={'email':'guest@example.com','password':'TestingPass123!'})
    assert r.status_code == 200
    headers = {'Authorization':'Bearer '+r.json()['access_token']}
    assert client.get('/api/auth/me',headers=headers).status_code == 200
    assert client.post('/api/auth/logout',headers=headers).status_code == 200
    assert client.get('/api/auth/me',headers=headers).status_code == 401
    assert call('PUT',f'/users/{fixture["users"]["reception"]}',{'name':'Reception User','is_active':False},'admin').status_code == 200
    assert client.post('/api/auth/login',json={'email':'reception@example.com','password':'TestingPass123!'}).status_code == 401
    assert call('GET','/rooms').status_code == 401


def test_protected_without_jwt(client):
    assert client.get('/api/rooms').status_code == 401


@pytest.mark.parametrize('role,method,path',[
    ('guest','GET','/users'),('guest','GET','/rooms'),('guest','POST','/reservations/1/check-in'),
    ('guest','POST','/reservations/1/no-show'),('guest','GET','/housekeeping/tasks'),
    ('hk','POST','/reservations'),('hk','POST','/rooms/1/inspect'),('hk','GET','/reservations'),
    ('hk','PATCH','/rooms/1/operational'),('reception','GET','/users'),('reception','PUT','/settings'),
    ('admin','POST','/housekeeping/tasks/1/start'),('reception','POST','/housekeeping/tasks/1/complete')
])
def test_permission_matrix(call,role,method,path):
    assert call(method,path,{},role).status_code == 403


def test_staff_create_and_profile(call):
    r = call('POST','/users',{'name':'New Cleaner','email':'cleaner@example.com','password':'SecureStaff123','role':'Housekeeping'},'admin')
    assert r.status_code == 201
    assert 'password_hash' not in r.json()
    assert call('PUT','/profile',{'name':'Updated Guest','phone':'123'},'guest').json()['phone'] == '123'


@pytest.mark.parametrize('capacity,price',[(0,450),(-1,450),(2,0),(2,-1),(2,'12.345')])
def test_invalid_room_type(call,capacity,price):
    assert call('POST','/room-types',{'name':'New Room','description':'','capacity':capacity,'base_price_per_night':price},'admin').status_code == 422


def test_type_room_configuration_and_snapshot(call,fixture,booked):
    data = {'name':'Standard King','description':'Updated','capacity':2,'base_price_per_night':650,'is_active':True}
    assert call('PUT',f'/room-types/{fixture["types"][0]}',data,'admin').status_code == 200
    original = call('GET',f'/reservations/{booked["id"]}').json()
    assert float(original['price_per_night']) == 450
    assert float(original['total_stay_cost']) == 1350
    assert call('POST','/rooms',{'room_number':'101','room_type_id':fixture['types'][0]},'admin').status_code == 409
    assert call('POST','/rooms',{'room_number':'103','room_type_id':fixture['types'][0]},'admin').status_code == 201
    data['is_active'] = False
    assert call('PUT',f'/room-types/{fixture["types"][0]}',data,'admin').status_code == 200
    future = {'room_type_id':fixture['types'][0],'guest_id':fixture['guests']['guest'],'check_in_date':'2030-11-01','check_out_date':'2030-11-03','guest_count':2}
    assert call('POST','/reservations',future).status_code == 409


def test_settings(call):
    assert call('PUT','/settings',{'hotel_name':'New Hotel','check_in_time':'16:00','check_out_time':'11:00'},'admin').status_code == 200
    assert call('GET','/settings').json()['check_in_time'] == '16:00:00'
    assert call('PUT','/settings',{'hotel_name':'Bad Hotel','check_in_time':'11:00','check_out_time':'16:00'},'admin').status_code == 422


@pytest.mark.parametrize('change',[{'guest_count':0},{'guest_count':3},{'check_out_date':'2030-10-10'},{'check_in_date':'2030-10-09'},{'check_out_date':'2032-01-01'}])
def test_invalid_stays(call,stay,change):
    assert call('POST','/reservations',{**stay,**change}).status_code == 422


def test_guest_creation_ownership(call,stay,fixture):
    body = {k:v for k,v in stay.items() if k!='guest_id'}
    r = call('POST','/reservations',body,'guest')
    assert r.status_code == 201
    rid = r.json()['id']
    assert r.json()['assigned_room_id'] is None
    assert r.json()['number_of_nights'] == 3
    assert float(r.json()['total_stay_cost']) == 1350
    assert call('GET',f'/reservations/{rid}',role='other').status_code == 404
    assert call('PUT',f'/reservations/{rid}',body,'other').status_code == 404
    assert call('POST',f'/reservations/{rid}/cancel',role='other').status_code == 404
    assert call('GET','/reservations',role='other').json() == []


def test_overbooking_and_turnover(call,stay,booked):
    assert call('POST','/reservations',stay).status_code == 409
    assert call('POST','/reservations',{**stay,'check_in_date':'2030-10-13','check_out_date':'2030-10-15'}).status_code == 201
    avail = call('GET','/availability?check_in_date=2030-10-11&check_out_date=2030-10-12&guest_count=2').json()
    assert all(t['id']!=stay['room_type_id'] for t in avail)


def test_availability_uses_peak_per_night(call,stay,fixture):
    # Two consecutive bookings consume one concurrent room, not two.
    assert call('POST','/rooms',{'room_number':'103','room_type_id':fixture['types'][0]},'admin').status_code == 201
    assert call('POST','/reservations',{**stay,'check_out_date':'2030-10-11'}).status_code == 201
    assert call('POST','/reservations',{**stay,'check_in_date':'2030-10-11','check_out_date':'2030-10-12'}).status_code == 201
    response = call('GET','/availability?check_in_date=2030-10-10&check_out_date=2030-10-12&guest_count=2')
    t = next(t for t in response.json() if t['id']==stay['room_type_id'])
    assert t['available_rooms'] == 1
    assert call('POST','/reservations',{**stay,'check_out_date':'2030-10-12'}).status_code == 201
    assert call('POST','/reservations',{**stay,'check_out_date':'2030-10-12'}).status_code == 409


def test_invalid_modification_preserves_original(call,stay,fixture):
    future={**stay,'check_in_date':'2030-10-12','check_out_date':'2030-10-15'}
    booked=call('POST','/reservations',future).json()
    path=f'/reservations/{booked["id"]}'
    assert call('POST',path+'/assign',{'room_id':fixture['rooms'][0]}).status_code == 200
    original=call('GET',path).json()
    change={k:v for k,v in future.items() if k!='guest_id'}
    assert call('PUT',path,{**change,'guest_count':3},'guest').status_code == 422
    assert call('GET',path).json()==original
    assert call('PUT',path,{**change,'check_out_date':'2030-10-16'},'guest').status_code == 200
    updated=call('GET',path).json()
    assert updated['assigned_room_id'] is None and updated['number_of_nights']==4


def test_modification_inventory_rechecked(call,stay,fixture):
    a=call('POST','/reservations',{**stay,'check_in_date':'2030-10-12','check_out_date':'2030-10-14'}).json()
    b=call('POST','/reservations',{**stay,'check_in_date':'2030-10-14','check_out_date':'2030-10-16'}).json()
    changed={k:v for k,v in stay.items() if k!='guest_id'}
    changed.update(check_in_date='2030-10-13',check_out_date='2030-10-15')
    assert call('PUT',f'/reservations/{b["id"]}',changed,'guest').status_code==409
    assert call('GET',f'/reservations/{b["id"]}').json()['check_in_date']=='2030-10-14'


def test_cancellation_releases_inventory(call,stay):
    future={**stay,'check_in_date':'2030-10-12','check_out_date':'2030-10-14'}
    booked=call('POST','/reservations',future).json()
    assert call('POST',f'/reservations/{booked["id"]}/cancel',role='guest').status_code==200
    assert call('POST','/reservations',future).status_code==201
    assert call('GET',f'/reservations/{booked["id"]}').json()['status']=='Cancelled'


def test_no_show_policy(call,booked,stay):
    assert call('POST',f'/reservations/{booked["id"]}/no-show').status_code==200
    assert call('POST','/reservations',stay).status_code==201
    r=call('POST','/reservations',{**stay,'check_in_date':'2030-10-15','check_out_date':'2030-10-17'}).json()
    assert call('POST',f'/reservations/{r["id"]}/no-show').status_code==409


def test_assignment_rules(call,booked,fixture,stay):
    path=f'/reservations/{booked["id"]}'
    assert call('POST',path+'/check-in').status_code==409
    assert call('POST',path+'/assign',{'room_id':fixture['rooms'][1]}).status_code==409
    assert call('POST',path+'/assign',{'room_id':fixture['rooms'][0]}).status_code==200
    new=call('POST','/rooms',{'room_number':'103','room_type_id':fixture['types'][0]},'admin').json()
    another=call('POST','/reservations',stay).json()
    assert call('POST',f'/reservations/{another["id"]}/assign',{'room_id':fixture['rooms'][0]}).status_code==409
    assert call('POST',path+'/assign',{'room_id':new['id']}).status_code==200


@pytest.mark.parametrize('dimension,value',[('housekeeping_status','Dirty'),('housekeeping_status','Clean'),('operational_status','Out of Order'),('occupancy_status','Occupied'),('is_active',False)])
def test_readiness_check(call,booked,fixture,dimension,value):
    path=f'/reservations/{booked["id"]}'
    assert call('POST',path+'/assign',{'room_id':fixture['rooms'][0]}).status_code==200
    with SessionLocal.begin() as db:
        setattr(db.get(Room,fixture['rooms'][0]),dimension,value)
    assert call('POST',path+'/check-in').status_code==409
    assert call('GET',path).json()['status']=='Confirmed'


def test_arrival_date_and_time(call,stay,fixture,monkeypatch):
    tomorrow=call('POST','/reservations',{**stay,'check_in_date':'2030-10-11'}).json()
    path=f'/reservations/{tomorrow["id"]}'
    call('POST',path+'/assign',{'room_id':fixture['rooms'][0]})
    assert call('POST',path+'/check-in').status_code==409
    monkeypatch.setattr(services,'now_local',lambda:datetime(2030,10,11,14,59,tzinfo=ZoneInfo('Asia/Riyadh')))
    assert call('POST',path+'/check-in').status_code==409


def test_full_operational_lifecycle(call,booked,fixture):
    path=f'/reservations/{booked["id"]}'
    call('POST',path+'/assign',{'room_id':fixture['rooms'][0]})
    assert call('POST',path+'/check-in').json()['status']=='Checked In'
    assert call('POST',path+'/check-in').status_code==409
    assert call('POST',path+'/cancel').status_code==409
    room=next(r for r in call('GET','/rooms').json() if r['id']==fixture['rooms'][0])
    assert room['occupancy_status']=='Occupied' and room['housekeeping_status']=='Inspected'
    assert call('POST',path+'/check-out').json()['status']=='Checked Out'
    assert call('POST',path+'/check-out').status_code==409
    tasks=call('GET','/housekeeping/tasks').json()
    assert len(tasks)==1 and tasks[0]['status']=='Open'
    tid=tasks[0]['id']
    assert call('GET','/housekeeping/tasks',role='hk').json()==[]
    assert call('POST',f'/housekeeping/tasks/{tid}/assign',{'assigned_staff_id':fixture['users']['hk'],'priority':'High'}).status_code==200
    assert call('POST',f'/housekeeping/tasks/{tid}/start',role='hk2').status_code==404
    assert call('POST',f'/housekeeping/tasks/{tid}/complete',{'notes':''},'hk').status_code==409
    assert call('POST',f'/housekeeping/tasks/{tid}/start',role='hk').status_code==200
    assert call('POST',f'/housekeeping/tasks/{tid}/complete',{'notes':'Fresh linens.'},'hk').status_code==200
    room=next(r for r in call('GET','/rooms').json() if r['id']==fixture['rooms'][0])
    assert (room['occupancy_status'],room['housekeeping_status'],room['is_ready'])==('Vacant','Clean',False)
    assert call('POST',f'/rooms/{room["id"]}/inspect').status_code==200
    assert next(r for r in call('GET','/rooms').json() if r['id']==room['id'])['is_ready'] is True


def test_issue_reporting_does_not_change_room(call,fixture):
    with SessionLocal.begin() as db:
        db.add(HousekeepingTask(room_id=fixture['rooms'][0],assigned_staff_id=fixture['users']['hk']))
    r=call('POST','/issues',{'room_id':fixture['rooms'][0],'description':'Broken light in bathroom'},'hk')
    assert r.status_code==201
    assert call('POST','/issues',{'room_id':fixture['rooms'][1],'description':'Broken light in bathroom'},'hk').status_code==403
    assert call('GET','/rooms').json()[0]['operational_status']=='In Service'
    assert call('POST',f'/issues/{r.json()["id"]}/resolve').json()['status']=='Resolved'


def test_out_of_order_and_inventory_guard(call,fixture,booked):
    path=f'/rooms/{fixture["rooms"][0]}/operational'
    assert call('PATCH',path,{'operational_status':'Out of Order'}).status_code==409
    call('POST',f'/reservations/{booked["id"]}/cancel')
    assert call('PATCH',path,{'operational_status':'Out of Order'}).status_code==200
    room=call('GET','/rooms').json()[0]
    assert room['occupancy_status']=='Vacant' and room['housekeeping_status']=='Inspected' and not room['is_ready']
    avail=call('GET','/availability?check_in_date=2030-10-12&check_out_date=2030-10-14&guest_count=2').json()
    assert all(t['id']!=fixture['types'][0] for t in avail)
    assert call('PATCH',path,{'operational_status':'In Service'}).json()['is_ready'] is True


def test_walkin_atomic_failure_and_success(call,fixture,stay):
    body={**stay,'room_id':fixture['rooms'][0]}
    with SessionLocal.begin() as db:
        db.get(Room,body['room_id']).housekeeping_status='Dirty'
    assert call('POST','/walk-ins',body).status_code==409
    assert call('GET','/reservations').json()==[]
    with SessionLocal.begin() as db:
        db.get(Room,body['room_id']).housekeeping_status='Inspected'
    assert call('POST','/walk-ins',body).json()['status']=='Checked In'
    assert call('POST','/walk-ins',body).status_code==409


@pytest.mark.parametrize('role',['admin','reception','hk','guest'])
def test_role_dashboards(call,role):
    response=call('GET','/dashboard',role=role)
    assert response.status_code==200
    assert ('counts' in response.json())==(role in ('admin','reception'))


@pytest.mark.postgres
def test_competing_bookings_are_serialized(fixture,stay):
    if engine.dialect.name!='postgresql':
        pytest.skip('PostgreSQL row locks are required for this test.')
    def reserve(_):
        with TestClient(app) as client:
            return client.post('/api/reservations',json=stay,headers=fixture['headers']['reception']).status_code
    with ThreadPoolExecutor(max_workers=4) as executor:
        results=list(executor.map(reserve,range(4)))
    assert sorted(results)==[201,409,409,409]
    with SessionLocal() as db:
        assert len(db.scalars(select(Reservation)).all())==1
