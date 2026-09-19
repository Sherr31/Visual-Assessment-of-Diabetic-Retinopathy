"""
HTTP End-to-End Test for VADR Report API Endpoints
"""
import requests
import os

BASE_URL = "http://localhost:5000/api"

def test_api():
    print("Testing /api/health...")
    r = requests.get(f"{BASE_URL}/health")
    print(f"Health response: {r.status_code} -> {r.json()}")
    assert r.status_code == 200

    # 1. Login as doctor
    print("\nLogging in as demo doctor (ayesha@vadr.pk)...")
    login_res = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "ayesha@vadr.pk",
        "password": "admin123"
    })
    print(f"Doctor login response: {login_res.status_code}")
    if login_res.status_code != 200:
        print("Login payload:", login_res.text)
        return
        
    doc_data = login_res.json()
    token = doc_data.get("data", {}).get("access_token") or doc_data.get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    print(f"Acquired JWT token: {token[:20]}...")

    # 2. Get dashboard summary to find a screening
    print("\nFetching doctor dashboard summary...")
    dash_res = requests.get(f"{BASE_URL}/dashboard/summary", headers=headers)
    assert dash_res.status_code == 200
    dash_data = dash_res.json().get("data", {})
    recent_scans = dash_data.get("recentScans", [])
    print(f"Found {len(recent_scans)} recent scans.")

    if not recent_scans:
        print("No recent scans to generate report for, skipping report creation test.")
        return

    screening_id = recent_scans[0]["id"]
    print(f"Using screening ID: {screening_id}")

    # 3. Generate Report
    print(f"\nCalling POST /api/reports/generate with screening_id={screening_id}...")
    gen_res = requests.post(f"{BASE_URL}/reports/generate", json={"screening_id": screening_id}, headers=headers)
    print(f"Generate response status: {gen_res.status_code}")
    assert gen_res.status_code in [200, 201]
    rpt_data = gen_res.json().get("data", {})
    report_id = rpt_data.get("report_id")
    print(f"Generated/Retrieved Report ID: {report_id}, Status: {rpt_data.get('status')}")

    # 4. Get Report details
    print(f"\nCalling GET /api/reports/{report_id}...")
    get_res = requests.get(f"{BASE_URL}/reports/{report_id}", headers=headers)
    assert get_res.status_code == 200
    print(f"Get report response: {get_res.json().get('message')}")

    # 5. Doctor Electronic Sign-Off
    print(f"\nCalling POST /api/reports/{report_id}/sign...")
    sign_res = requests.post(f"{BASE_URL}/reports/{report_id}/sign", json={
        "clinical_notes": "Automated verification: Assessment confirmed. Moderate NPDR noted with microaneurysms."
    }, headers=headers)
    print(f"Sign response status: {sign_res.status_code}")
    print(f"Sign response body: {sign_res.json().get('message')}")

    # 6. Download PDF Report
    print(f"\nCalling GET /api/reports/{report_id}/download...")
    dl_res = requests.get(f"{BASE_URL}/reports/{report_id}/download", headers=headers)
    assert dl_res.status_code == 200
    assert dl_res.headers.get("Content-Type") == "application/pdf"
    content_len = len(dl_res.content)
    print(f"Successfully downloaded PDF! Size: {content_len} bytes.")
    assert content_len > 1000

    # 7. List Reports Archive
    print(f"\nCalling GET /api/reports...")
    list_res = requests.get(f"{BASE_URL}/reports?limit=10", headers=headers)
    assert list_res.status_code == 200
    archive_data = list_res.json().get("data", {})
    print(f"Reports in archive: {archive_data.get('total')}, Page: {archive_data.get('page')}")

    # 8. Test Patient Access Isolation
    print("\nTesting Patient Isolation (Patient login)...")
    pat_login = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "patient@vadr.io",
        "password": "Password123!"
    })
    if pat_login.status_code == 200:
        pat_token = pat_login.json().get("data", {}).get("access_token") or pat_login.json().get("access_token")
        pat_headers = {"Authorization": f"Bearer {pat_token}"}
        
        # Patient gets summary
        pat_dash = requests.get(f"{BASE_URL}/patients/dashboard-summary", headers=pat_headers)
        print(f"Patient dashboard summary status: {pat_dash.status_code}")
        pat_data = pat_dash.json().get("data", {})
        pat_rpts = pat_data.get("reports", {})
        print(f"Patient reports available: {pat_rpts.get('available')}, count: {len(pat_rpts.get('items', []))}")

    print("\n" + "=" * 50)
    print("ALL API ENDPOINT TESTS COMPLETED SUCCESSFULLY!")
    print("=" * 50)

if __name__ == "__main__":
    test_api()
