#!/usr/bin/env python3
"""Exercise the packaged app against a NEW temporary PostgreSQL cluster.

Requires initdb, pg_ctl, psql, createdb, Java, and a built backend JAR.
Never connects to the developer's existing database. Temporary files are retained.
"""
import datetime
import http.cookiejar
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import tempfile
import time
import traceback
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]


def port():
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0))
        return listener.getsockname()[1]


def run(args, env, **kwargs):
    result = subprocess.run(args, env=env, text=True, capture_output=True, **kwargs)
    if result.returncode:
        # Never include SQL, passwords, or subprocess environment in the error.
        raise RuntimeError(f'{Path(args[0]).name} failed; inspect the private temporary test files.')
    return result.stdout


def main():
    for binary in ('initdb', 'pg_ctl', 'psql', 'createdb', 'java'):
        if not shutil.which(binary):
            raise RuntimeError(f'{binary} is required for this optional integration check.')
    jar = ROOT / 'backend/target/backend-0.0.1-SNAPSHOT.jar'
    if not jar.exists():
        raise RuntimeError('Build the backend first: cd backend && ./mvnw verify')
    work = Path(tempfile.mkdtemp(prefix='healthbridge-smoke-'))
    os.chmod(work, 0o700)
    print(f'Isolated test files: {work}')
    pg_port, api_port = port(), port()
    while api_port == pg_port:
        api_port = port()
    # Discard inherited connection/JVM overrides so the check cannot target a user's database.
    inherited = {key: value for key, value in os.environ.items()
                 if not key.startswith(('PG', 'DB_', 'SPRING_', 'SERVER_', 'POSTGRES_', 'SESSION_', 'LOADER_', 'LOGGING_', 'SENDGRID_'))
                 and key not in ('JAVA_TOOL_OPTIONS', 'JDK_JAVA_OPTIONS', '_JAVA_OPTIONS')}
    env = dict(inherited, PGHOST=str(work), PGPORT=str(pg_port),
               POSTGRES_USER='hb_bootstrap', POSTGRES_DB='healthbridge_smoke',
               DB_USERNAME='hb_smoke_app', DB_PASSWORD=secrets.token_urlsafe(24))
    env.update(PGUSER=env['POSTGRES_USER'], PGDATABASE=env['POSTGRES_DB'])
    cluster = work / 'postgres'
    backend = None
    pg_started = False
    try:
        run(['initdb', '-D', str(cluster), '--username', env['POSTGRES_USER'], '--no-locale',
             '--encoding=UTF8', '--auth-local=trust', '--auth-host=scram-sha-256'], env)
        with (cluster / 'postgresql.conf').open('a') as config:
            config.write(f"\nlisten_addresses='127.0.0.1'\nport={pg_port}\nunix_socket_directories='{work}'\n")
        run(['pg_ctl', '-D', str(cluster), '-l', str(work / 'postgres.log'), '-w', 'start'], env)
        pg_started = True
        run(['createdb', env['POSTGRES_DB']], env)
        run(['sh', str(ROOT / 'docker/postgres/init.sh')], env | {'HEALTHBRIDGE_SQL_DIR': str(ROOT / 'backend/database')})
        test_password = secrets.token_urlsafe(24)
        sql = f"""
        CREATE EXTENSION pgcrypto;
        INSERT INTO members(member_id, full_name, email, plan_name, plan_type, coverage_status)
          VALUES ('HB200246', 'Synthetic Second Member', 'second@example.com', 'Demo Silver HMO', 'HMO', 'Active');
        INSERT INTO member_benefits VALUES ('HB200246', 2000, 100, 6000, 200, 30, 60, 80);
        INSERT INTO claims(claim_number, member_id, provider_name, service_date, claim_status, billed_amount,
          insurance_paid, member_responsibility, service, submitted_date, notes)
          VALUES ('CLM9001', 'HB200246', 'Synthetic Clinic', '2026-10-01', 'Approved', 100, 70, 30,
                  'Synthetic visit', '2026-10-02', 'Synthetic claim');
        INSERT INTO coverage_items VALUES ('MC9001', 'HB200246', 'Medical', 'Second member coverage',
          'Covered', '$30 copay', 'Synthetic benefit', 1);
        INSERT INTO prescriptions(member_id, medication, dosage, pharmacy, refill_status)
          VALUES ('HB200246', 'Synthetic second prescription', 'Demo dosage', 'Demo Pharmacy', 'Available');
        INSERT INTO member_accounts(member_id, email, password_hash)
          VALUES ('HB100245', 'member.a@example.com', crypt('{test_password}', gen_salt('bf', 10))),
                 ('HB200246', 'member.b@example.com', crypt('{test_password}', gen_salt('bf', 10)));
        """
        sql += "INSERT INTO account_roles(member_id,role_name) VALUES ('HB100245','MEMBER'),('HB200246','MEMBER');"
        sql += f"""
        INSERT INTO members(member_id,full_name,email,plan_name,plan_type,coverage_status)
            VALUES ('HAADMIN','Synthetic Administrator','admin@example.com','Administrative account','PPO','Inactive');
        INSERT INTO member_accounts(member_id,email,password_hash)
            VALUES ('HAADMIN','admin@example.com',crypt('{test_password}',gen_salt('bf',10)));
        INSERT INTO account_roles(member_id,role_name) VALUES ('HAADMIN','ADMIN');
        """
        run(['psql', '-X', '-v', 'ON_ERROR_STOP=1', '-q'], env, input=sql)
        app_env = env | {'DB_URL': f'jdbc:postgresql://127.0.0.1:{pg_port}/{env["POSTGRES_DB"]}',
                         'SERVER_PORT': str(api_port), 'SERVER_ADDRESS': '127.0.0.1', 'SESSION_COOKIE_SECURE': 'false'}
        with (work / 'backend.log').open('w') as log:
            backend = subprocess.Popen(['java', '-jar', str(jar)], env=app_env, stdout=log, stderr=log)
        base = f'http://127.0.0.1:{api_port}/api/v1'

        def client():
            return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

        def request(browser, path, method='GET', data=None, token=None):
            headers = {'Content-Type': 'application/json'}
            if token:
                headers['X-XSRF-TOKEN'] = token
            req = urllib.request.Request(base + path, method=method, headers=headers,
                data=None if data is None else json.dumps(data).encode())
            try:
                response = browser.open(req, timeout=5)
            except urllib.error.HTTPError as error:
                response = error
            with response:
                raw = response.read()
                return response.status, json.loads(raw) if raw else None

        first, second = client(), client()
        deadline = time.monotonic() + 45
        while True:
            try:
                assert request(first, '/auth/me')[0] == 401
                break
            except (OSError, AssertionError):
                if backend.poll() is not None or time.monotonic() > deadline:
                    raise RuntimeError('Packaged backend did not become ready; inspect the private backend.log.')
                time.sleep(0.2)
        assert request(first, '/members/me/benefits')[0] == 401
        assert request(first, '/auth/login', 'POST', {})[0] == 403
        old_token = None
        for browser, email, member in [(first, 'member.a@example.com', 'HB100245'),
                                        (second, 'member.b@example.com', 'HB200246')]:
            status, csrf = request(browser, '/auth/csrf')
            assert status == 200
            if browser is first:
                old_token = csrf['token']
            status, account = request(browser, '/auth/login', 'POST',
                {'email': email, 'password': test_password}, csrf['token'])
            assert status == 200 and account['memberId'] == member
            for path in ('/members/me/benefits', '/members/me/profile'):
                status, data = request(browser, path + '?memberId=OTHER')
                assert status == 200 and data['memberId'] == member
            assert request(browser, '/providers')[0] == 200
        status, a_claims = request(first, '/members/me/claims?memberId=HB200246')
        assert status == 200 and len(a_claims) == 5 and all(row['id'] != 'CLM-9001' for row in a_claims)
        status, b_claims = request(second, '/members/me/claims?memberId=HB100245')
        assert status == 200 and [row['id'] for row in b_claims] == ['CLM-9001']
        assert len(request(first, '/members/me/prescriptions')[1]) == 2
        assert len(request(second, '/members/me/prescriptions')[1]) == 1
        contact = {'memberId': 'HB200246', 'phone': '555-0101', 'address': 'Synthetic address'}
        assert request(first, '/members/me/profile', 'PATCH', contact, old_token)[0] == 403
        token = request(first, '/auth/csrf')[1]['token']
        status, updated = request(first, '/members/me/profile', 'PATCH', contact, token)
        assert status == 200 and updated['phone'] == '555-0101' and updated['memberId'] == 'HB100245'
        assert request(second, '/members/me/profile')[1]['phone'] is None
        assert request(first, '/members/me/profile', 'PATCH', {'phone': '<invalid>', 'address': ''}, token)[0] == 400
        # Real administrator flows, with the same restricted database role as the application.
        administrator = client()
        assert request(first, '/admin/dashboard')[0] == 403
        admin_csrf = request(administrator, '/auth/csrf')[1]['token']
        status, admin_user = request(administrator, '/auth/login', 'POST',
            {'email': 'admin@example.com', 'password': test_password}, admin_csrf)
        assert status == 200 and admin_user['roles'] == ['ADMIN']
        assert request(administrator, '/members/me/profile')[0] == 403
        admin_csrf = request(administrator, '/auth/csrf')[1]['token']
        status, stats = request(administrator, '/admin/dashboard')
        assert status == 200 and stats['totalMembers'] == 2 and stats['enabledAccounts'] == 2
        page0 = request(administrator, '/admin/members?size=1&page=0')[1]
        page1 = request(administrator, '/admin/members?size=1&page=1')[1]
        assert page0['totalElements'] == 2 and len(page0['items']) == 1
        assert page0['items'][0]['memberId'] != page1['items'][0]['memberId']
        assert all('address' not in item for item in page0['items'])
        search = request(administrator, '/admin/members?search=SYNTHETIC%20SECOND')[1]
        assert search['totalElements'] == 1 and search['items'][0]['memberId'] == 'HB200246'
        assert request(administrator, '/admin/members?search=%25')[1]['totalElements'] == 0
        assert request(administrator, '/admin/members?coverage=Inactive')[1]['totalElements'] == 0
        assert request(administrator, '/admin/members?account=enabled')[1]['totalElements'] == 2
        assert request(administrator, '/admin/members?size=101')[0] == 400
        sorted_members = request(administrator, '/admin/members?sort=name-asc')[1]['items']
        assert [m['fullName'].lower() for m in sorted_members] == sorted(m['fullName'].lower() for m in sorted_members)
        assert request(administrator, '/admin/members?sort=unsupported')[0] == 400
        # Publish configured coverage before enrollment; a member can never publish plans.
        year = datetime.date.today().year
        plan_input = {'planName': 'Demo Silver EPO', 'planType': 'EPO',
                      'effectiveFrom': f'{year}-01-01', 'effectiveTo': f'{year}-12-31',
                      'deductibleTotal': 1800, 'oopMaximum': 6000,
                      'primaryCare': 30, 'specialist': 60, 'urgentCare': 80,
                      'coverage': [{'name': 'Preventive care', 'category': 'Medical', 'status': 'Covered', 'cost': '$0', 'notes': 'In network'},
                                   {'name': 'Generic drugs', 'category': 'Pharmacy', 'status': 'Covered', 'cost': '$10', 'notes': 'Formulary applies'},
                                   {'name': 'Cosmetic procedures', 'category': 'Medical', 'status': 'Not Covered', 'cost': 'Not covered', 'notes': 'Excluded'}]}
        assert request(first, '/admin/insurance-plans', 'POST', plan_input, token)[0] == 403
        assert request(administrator, '/admin/insurance-plans', 'POST', plan_input)[0] == 403
        assert request(administrator, '/admin/insurance-plans', 'POST', dict(plan_input, oopMaximum=1), admin_csrf)[0] == 400
        status, configured_plan = request(administrator, '/admin/insurance-plans', 'POST', plan_input, admin_csrf)
        assert status == 201
        assert request(administrator, '/admin/insurance-plans', 'POST', plan_input, admin_csrf)[0] == 409
        assert any(p['id'] == configured_plan['id'] for p in request(administrator, '/admin/plans')[1])
        # Duplicate account email must roll back the earlier member INSERT too.
        enrollment = {'fullName': 'Synthetic New Enrollee', 'email': 'member.a@example.com',
                      'phone': '555-0105', 'address': 'Synthetic enrollment address', 'planName': 'Demo Silver EPO',
                      'planType': 'EPO', 'coverageStatus': 'Inactive', 'role': 'ADMIN', 'planId': configured_plan['id']}
        assert request(administrator, '/admin/members', 'POST', enrollment, admin_csrf)[0] == 409
        assert request(administrator, '/admin/dashboard')[1]['totalMembers'] == 2
        enrollment['email'] = 'new.member@example.com'
        assert request(first, '/admin/members', 'POST', enrollment, token)[0] == 403
        status, registration = request(administrator, '/admin/members', 'POST', enrollment, admin_csrf)
        assert status == 201
        new_member = registration['details']['summary']['memberId']
        setup_token = registration['setupToken']
        assert registration['details']['summary']['passwordSetupRequired']
        assert not registration['details']['summary']['accountEnabled']
        assert 'password_hash' not in json.dumps(registration)
        assert request(administrator, '/admin/dashboard')[1]['totalMembers'] == 3
        assert request(administrator, '/admin/members?account=pending')[1]['totalElements'] == 1
        role = run(['psql', '-X', '-A', '-t'], env, input=f"SELECT role_name FROM account_roles WHERE member_id='{new_member}';").strip()
        assert role == 'MEMBER'
        newcomer = client()
        newcomer_csrf = request(newcomer, '/auth/csrf')[1]['token']
        new_password = secrets.token_urlsafe(24)
        assert request(newcomer, '/auth/login', 'POST', {'email': enrollment['email'], 'password': new_password}, newcomer_csrf)[0] == 401
        password_input = {'token': setup_token, 'password': new_password}
        assert request(newcomer, '/auth/password-setup', 'POST', password_input)[0] == 403
        assert request(newcomer, '/auth/password-setup', 'POST', password_input, newcomer_csrf)[0] == 204
        assert request(newcomer, '/auth/password-setup', 'POST', password_input, newcomer_csrf)[0] == 400
        assert request(newcomer, '/auth/me')[0] == 401  # Setup never auto-authenticates.
        assert request(newcomer, '/auth/login', 'POST', {'email': enrollment['email'], 'password': new_password}, newcomer_csrf)[0] == 200
        assert request(newcomer, '/admin/dashboard')[0] == 403
        status, new_benefits = request(newcomer, '/members/me/benefits')
        assert status == 200 and new_benefits['memberId'] == new_member and new_benefits['benefitsConfigured']
        assert new_benefits['deductible'] == {'total': 1800, 'met': 0}
        assert new_benefits['outOfPocket'] == {'maximum': 6000, 'spent': 0}
        assert new_benefits['copays']['primaryCare'] == 30
        assert len(new_benefits['coverage']) == 3
        assert new_benefits['effectiveFrom'] == plan_input['effectiveFrom']
        assert request(newcomer, '/members/me/claims')[1] == []
        assert request(newcomer, '/members/me/prescriptions')[1] == []
        assert request(newcomer, '/providers')[0] == 200
        assert request(newcomer, '/members/me/profile')[1]['memberId'] == new_member
        member_csrf = request(newcomer, '/auth/csrf')[1]['token']
        status, own_profile = request(newcomer, '/members/me/profile', 'PATCH',
            {'phone': '555-0199', 'address': 'Synthetic self-service address'}, member_csrf)
        assert status == 200 and own_profile['phone'] == '555-0199' and own_profile['memberId'] == new_member
        assert request(first, '/members/me/profile')[1]['phone'] == '555-0101'

        # Optimistic locking, duplicate-update rollback, and session invalidation on email change.
        detail_path = '/admin/members/' + new_member
        detail = request(administrator, detail_path)[1]
        edit = dict(enrollment, email='updated.member@example.com', coverageStatus='Active', version=detail['summary']['version'])
        status, updated = request(administrator, detail_path, 'PATCH', edit, admin_csrf)
        assert status == 200 and updated['summary']['email'] == edit['email']
        assert request(newcomer, '/auth/me')[0] == 401
        assert request(administrator, detail_path, 'PATCH', edit, admin_csrf)[0] == 409
        duplicate = dict(edit, email='member.a@example.com', fullName='Must roll back', version=updated['summary']['version'])
        assert request(administrator, detail_path, 'PATCH', duplicate, admin_csrf)[0] == 409
        assert request(administrator, detail_path)[1]['summary']['fullName'] == enrollment['fullName']
        newcomer_csrf = request(newcomer, '/auth/csrf')[1]['token']
        assert request(newcomer, '/auth/login', 'POST', {'email': edit['email'], 'password': new_password}, newcomer_csrf)[0] == 200
        current_version = request(administrator, detail_path)[1]['summary']['version']
        status, disabled = request(administrator, detail_path+'/account', 'PATCH', {'enabled': False, 'version': current_version}, admin_csrf)
        assert status == 200 and not disabled['summary']['accountEnabled']
        blocked_browser = client()
        blocked_csrf = request(blocked_browser, '/auth/csrf')[1]['token']
        assert request(blocked_browser, '/auth/login', 'POST',
            {'email': edit['email'], 'password': new_password}, blocked_csrf)[0] == 401

        status, enabled = request(administrator, detail_path+'/account', 'PATCH', {'enabled': True, 'version': disabled['summary']['version']}, admin_csrf)
        assert status == 200 and enabled['summary']['accountEnabled']
        assert request(newcomer, '/auth/me')[0] == 401  # Even without a request between disable and re-enable.
        blocked_csrf = request(blocked_browser, '/auth/csrf')[1]['token']
        assert request(blocked_browser, '/auth/login', 'POST',
            {'email': edit['email'], 'password': new_password}, blocked_csrf)[0] == 200

        # Expiration, supersession, revocation, and concurrent one-time consumption.
        pending = dict(enrollment, email='pending.member@example.com')
        status, pending_registration = request(administrator, '/admin/members', 'POST', pending, admin_csrf)
        assert status == 201
        pending_id = pending_registration['details']['summary']['memberId']
        pending_path = '/admin/members/' + pending_id
        pending_checker = client()
        pending_csrf = request(pending_checker, '/auth/csrf')[1]['token']
        changed_pending = dict(pending, email='changed.pending@example.com', version=0)
        assert request(administrator, pending_path, 'PATCH', changed_pending, admin_csrf)[0] == 200
        assert request(pending_checker, '/auth/password-setup', 'POST', {'token': pending_registration['setupToken'], 'password': new_password}, pending_csrf)[0] == 400
        status, pending_registration = request(administrator, pending_path+'/password-setup', 'POST', {'version': 1}, admin_csrf)
        assert status == 200
        run(['psql', '-X', '-v', 'ON_ERROR_STOP=1', '-q'], env,
            input=f"UPDATE account_password_setup SET expires_at=CURRENT_TIMESTAMP-INTERVAL '1 minute' WHERE member_id='{pending_id}';")
        setup_browser = client()
        setup_csrf = request(setup_browser, '/auth/csrf')[1]['token']
        assert request(setup_browser, '/auth/password-setup', 'POST', {'token': pending_registration['setupToken'], 'password': new_password}, setup_csrf)[0] == 400
        status, renewed = request(administrator, pending_path+'/password-setup', 'POST', {'version': pending_registration['details']['summary']['version']}, admin_csrf)
        assert status == 200 and renewed['setupToken'] != pending_registration['setupToken']
        assert request(setup_browser, '/auth/password-setup', 'POST', {'token': pending_registration['setupToken'], 'password': new_password}, setup_csrf)[0] == 400
        status, revoked = request(administrator, pending_path+'/account', 'PATCH', {'enabled': False, 'version': renewed['details']['summary']['version']}, admin_csrf)
        assert status == 200
        assert request(setup_browser, '/auth/password-setup', 'POST', {'token': renewed['setupToken'], 'password': new_password}, setup_csrf)[0] == 400
        status, renewed = request(administrator, pending_path+'/password-setup', 'POST', {'version': revoked['summary']['version']}, admin_csrf)
        assert status == 200
        def complete_once(_):
            browser = client()
            csrf_value = request(browser, '/auth/csrf')[1]['token']
            return request(browser, '/auth/password-setup', 'POST', {'token': renewed['setupToken'], 'password': new_password}, csrf_value)[0]
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=2) as workers:
            assert sorted(workers.map(complete_once, range(2))) == [204, 400]
        # A plan change must not present old financial terms as belonging to the new plan.
        original = request(administrator, '/admin/members/HB100245')[1]
        original_update = dict(original['summary'], address=original['address'] or '',
                               phone=original['summary']['phone'] or '', planName=plan_input['planName'], planType=plan_input['planType'], planId=configured_plan['id'])
        assert request(administrator, '/admin/members/HB100245', 'PATCH', original_update, admin_csrf)[0] == 200
        reassigned = request(first, '/members/me/benefits')[1]
        assert reassigned['benefitsConfigured']
        assert reassigned['deductible'] == {'total': 1800, 'met': 900}  # Preserve same-year historical spending.
        assert reassigned['outOfPocket']['spent'] == 1200
        # Real claims workflow: coverage snapshot, date validation, amounts, and exactly-once spending.
        coverage = request(administrator, '/admin/claims/member-coverage?memberId=HB100245')[1]
        covered = next(item for item in coverage['items'] if item['status'] == 'Covered')
        excluded = next(item for item in coverage['items'] if item['status'] == 'Not Covered')
        # A historical pending claim needs an explicit, audited coverage confirmation.
        run(['psql', '-X', '-v', 'ON_ERROR_STOP=1', '-q'], env, input="""
            INSERT INTO claims(claim_number,member_id,provider_name,service_date,claim_status,billed_amount,insurance_paid,member_responsibility,service,submitted_date)
            VALUES('CLM-LEGACY-CHECK','HB100245','Synthetic Clinic',CURRENT_DATE,'Pending',400,0,0,'Historical preventive care',CURRENT_DATE);
            """)
        coverage_path = '/admin/claims/CLM-LEGACY-CHECK/coverage'
        confirmation = {'version': 0, 'coverageItemId': covered['id'], 'confirmed': True}
        assert request(administrator, coverage_path, 'POST', confirmation)[0] == 403
        assert request(first, coverage_path, 'POST', confirmation, token)[0] == 403
        assert request(administrator, coverage_path, 'POST', dict(confirmation, confirmed=False), admin_csrf)[0] == 400
        status, confirmed_legacy = request(administrator, coverage_path, 'POST', confirmation, admin_csrf)
        assert status == 200 and confirmed_legacy['version'] == 1
        assert json.loads(confirmed_legacy['coverageSnapshot'])['coverageConfirmedBy']
        assert request(administrator, coverage_path, 'POST', dict(confirmation, version=1), admin_csrf)[0] == 409
        assert request(first, '/members/me/benefits')[1]['deductible']['met'] == 900

        claim_input = {'memberId': 'HB100245', 'coverageItemId': covered['id'], 'provider': 'Synthetic Clinic',
                       'serviceDate': datetime.date.today().isoformat(), 'billedAmount': 400, 'notes': 'Synthetic submission'}
        assert request(first, '/admin/claims', 'POST', claim_input, token)[0] == 403
        assert request(administrator, '/admin/claims', 'POST', dict(claim_input, serviceDate=f'{year-1}-12-31'), admin_csrf)[0] == 400
        assert request(administrator, '/admin/claims', 'POST', dict(claim_input, coverageItemId='missing'), admin_csrf)[0] == 400
        status, claim = request(administrator, '/admin/claims', 'POST', claim_input, admin_csrf)
        assert status == 201 and claim['status'] == 'Pending'
        assert request(first, '/members/me/benefits')[1]['deductible']['met'] == 900
        claim_path = '/admin/claims/' + claim['id']
        review = {'version': 0, 'status': 'Approved', 'allowedAmount': 300, 'insurancePaid': 200, 'memberResponsibility': 100,
                  'deductibleApplied': 50, 'oopApplied': 100, 'reviewNotes': 'Synthetic coverage review'}
        assert request(first, claim_path, 'PATCH', review, token)[0] == 403
        assert request(administrator, claim_path, 'PATCH', dict(review, insurancePaid=201), admin_csrf)[0] == 400
        assert request(administrator, claim_path, 'PATCH', dict(review, oopApplied=101), admin_csrf)[0] == 400
        def finalize_once(_):
            browser = client()
            csrf_value = request(browser, '/auth/csrf')[1]['token']
            assert request(browser, '/auth/login', 'POST', {'email': 'admin@example.com', 'password': test_password}, csrf_value)[0] == 200
            csrf_value = request(browser, '/auth/csrf')[1]['token']
            return request(browser, claim_path, 'PATCH', review, csrf_value)[0]
        with ThreadPoolExecutor(max_workers=2) as workers:
            assert sorted(workers.map(finalize_once, range(2))) == [200, 409]
        after_claim = request(first, '/members/me/benefits')[1]
        assert after_claim['deductible']['met'] == 950 and after_claim['outOfPocket']['spent'] == 1300
        final_claim = request(administrator, claim_path)[1]
        assert final_claim['status'] == 'Approved' and final_claim['reviewedBy']
        member_claim = next(c for c in request(first, '/members/me/claims')[1] if c['id'] == claim['id'])
        assert member_claim['allowedAmount'] == 300 and member_claim['deductibleApplied'] == 50
        status, denied = request(administrator, '/admin/claims', 'POST', dict(claim_input, coverageItemId=excluded['id']), admin_csrf)
        assert status == 201
        denied_path = '/admin/claims/' + denied['id']
        assert request(administrator, denied_path, 'PATCH', review, admin_csrf)[0] == 400
        denial = dict(review, status='Denied', allowedAmount=100, insurancePaid=0, memberResponsibility=100, deductibleApplied=0, oopApplied=0)
        assert request(administrator, denied_path, 'PATCH', denial, admin_csrf)[0] == 200
        assert request(first, '/members/me/benefits')[1]['deductible']['met'] == 950
        assert request(administrator, '/admin/claims?status=Pending')[0] == 200
        status, waiting = request(administrator, '/admin/claims', 'POST', claim_input, admin_csrf)
        assert status == 201
        # A new catalog version never changes an enrolled member's snapshot.
        status, revision = request(administrator, '/admin/insurance-plans', 'POST', dict(plan_input, planName='Demo Revised EPO', primaryCare=45), admin_csrf)
        assert status == 201
        assert request(first, '/members/me/benefits')[1]['copays']['primaryCare'] == 30
        assert request(administrator, f"/admin/insurance-plans/{configured_plan['id']}/retire", 'POST', {}, admin_csrf)[0] == 204
        assert not any(p['id'] == configured_plan['id'] for p in request(administrator, '/admin/plans')[1])
        assert request(administrator, '/admin/members', 'POST', dict(enrollment, email='retired@example.com'), admin_csrf)[0] == 400
        assert request(first, '/members/me/benefits')[1]['copays']['primaryCare'] == 30
        future = dict(plan_input, planName='Future plan', effectiveFrom=f'{year+1}-01-01', effectiveTo=f'{year+1}-12-31')
        status, future_plan = request(administrator, '/admin/insurance-plans', 'POST', future, admin_csrf)
        assert status == 201
        assert not any(p['id'] == future_plan['id'] for p in request(administrator, '/admin/plans')[1])
        # A pending claim cannot apply spending after the member changes plan versions.
        detail = request(administrator, '/admin/members/HB100245')[1]
        revised_enrollment = dict(detail['summary'], address=detail['address'] or '', phone=detail['summary']['phone'] or '',
                                 planId=revision['id'], planName=revision['planName'], planType=revision['planType'])
        assert request(administrator, '/admin/members/HB100245', 'PATCH', revised_enrollment, admin_csrf)[0] == 200
        assert request(administrator, '/admin/claims/' + waiting['id'], 'PATCH', review, admin_csrf)[0] == 409
        assert request(first, '/members/me/benefits')[1]['deductible']['met'] == 950
        # Migrations are safe to reapply and never promote existing members.
        for migration in ('V001__admin_members.sql', 'V002__runtime_permissions.sql', 'V003__insurance_plans.sql', 'V004__admin_claims.sql', 'V005__claim_coverage_review.sql'):
            run(['psql', '-X', '-v', 'ON_ERROR_STOP=1', '--single-transaction', '-f', str(ROOT/'backend/database/migrations'/migration)], env)
        assert request(administrator, '/admin/dashboard')[1]['totalMembers'] == 4
        stored = run(['psql', '-X', '-A', '-t'], env, input=f"SELECT token_hash FROM account_password_setup WHERE member_id='{pending_id}';").strip()
        assert len(stored) == 64 and stored != renewed['setupToken']
        privileges = run(['psql', '-X', '-A', '-t'], env, input="SELECT has_table_privilege('hb_smoke_app','account_roles','INSERT'),has_function_privilege('hb_smoke_app','public.enroll_member_role(character varying)','EXECUTE');").strip()
        assert privileges == 'f|t'
        assert request(administrator, '/auth/logout', 'POST', {}, admin_csrf)[0] == 204
        assert request(administrator, '/admin/dashboard')[0] == 401
        assert request(first, '/auth/logout', 'POST', {})[0] == 403
        assert request(first, '/auth/logout', 'POST', {}, token)[0] == 204
        assert request(first, '/members/me/benefits')[0] == 401
        assert request(second, '/members/me/benefits')[0] == 200
        run(['psql', '-X', '-v', 'ON_ERROR_STOP=1', '-q'], env,
            input="UPDATE member_accounts SET enabled = false WHERE member_id = 'HB200246';")
        assert request(second, '/members/me/benefits')[0] == 401
        privileges = run(['psql', '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], env, input="""
            SELECT has_column_privilege('hb_smoke_app', 'members', 'phone', 'UPDATE'),
                   has_column_privilege('hb_smoke_app', 'members', 'plan_name', 'UPDATE'),
                   has_table_privilege('hb_smoke_app', 'claims', 'DELETE');
            """).strip()
        assert privileges == 't|t|f'
        print('PASS: member/admin RBAC, stats, server pagination/search, transactional registration/update, one-time password setup (expiry/replay/revocation/concurrency), migrations, session revocation, role privileges, existing member APIs.')
        # Check actual inactivity expiry in Tomcat, not just a manually invalidated cookie.
        # A separate short-timeout instance is used only in this disposable test cluster.
        backend.terminate()
        backend.wait(timeout=10)
        app_env['SESSION_TIMEOUT'] = '1m'
        with (work / 'session-expiry-backend.log').open('w') as log:
            backend = subprocess.Popen(['java', '-jar', str(jar)], env=app_env, stdout=log, stderr=log)
        idle_browser = client()
        deadline = time.monotonic() + 45
        while True:
            try:
                assert request(idle_browser, '/auth/me')[0] == 401
                break
            except (OSError, AssertionError):
                if backend.poll() is not None or time.monotonic() > deadline:
                    raise RuntimeError('Temporary expiry-test backend did not start.')
                time.sleep(0.2)
        idle_csrf = request(idle_browser, '/auth/csrf')[1]['token']
        assert request(idle_browser, '/auth/login', 'POST',
            {'email': 'admin@example.com', 'password': test_password}, idle_csrf)[0] == 200
        assert request(idle_browser, '/admin/dashboard')[0] == 200
        print('PASS: authenticated before idle timeout. Waiting 63 seconds with no session requests...', flush=True)
        for elapsed in (21, 42, 63):
            time.sleep(21)
            print(f'Idle timeout wait: {elapsed}/63 seconds.', flush=True)
        assert request(idle_browser, '/admin/dashboard')[0] == 401
        print('PASS: real server-side idle-session expiration rejects the unchanged session cookie.', flush=True)

    finally:
        if backend is not None:
            backend.terminate()
            try:
                backend.wait(timeout=10)
            except subprocess.TimeoutExpired:
                backend.kill()
                backend.wait()
        if pg_started:
            run(['pg_ctl', '-D', str(cluster), '-m', 'fast', '-w', 'stop'], env)
        print('Temporary services stopped; existing databases were not accessed. Test files retained.')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Exception details can include request/SQL values. Report only a safe summary.
        frame = traceback.extract_tb(error.__traceback__)[-1]
        print(f'FAIL: {type(error).__name__} at {Path(frame.filename).name}:{frame.lineno}; inspect the private test files or check required local tools.')
        raise SystemExit(1) from None
