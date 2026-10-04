"""Tests for document upload, IPFS integration, and hash verification (FR-DOC-01, FR-DOC-02, FR-DOC-03)."""

import hashlib
import io
from app.models.entities import Shipment, Document
from tests.conftest import auth_header_for


def setup_shipment_with_doc(db_session, wallets):
    s = Shipment(
        shipment_id=1,
        external_ref="0x" + "aa" * 32,
        product_description="Pharmaceuticals",
        quantity=100,
        origin="Mumbai",
        destination="Delhi",
        dest_lat=0,
        dest_lon=0,
        geofence_radius_m=1000,
        shipper=wallets["shipper"].address.lower(),
        transporter=wallets["transporter"].address.lower(),
        receiver=wallets["receiver"].address.lower(),
        warehouse=None,
        inspector=wallets["inspector"].address.lower(),
        current_custodian=wallets["shipper"].address.lower(),
        status=0,
        expected_delivery=1800000000,
        payment_amount=0,
        created_block=1,
        created_tx_hash="0x" + "11" * 32,
    )
    db_session.add(s)

    content = b"Original Bill of Lading batch 404"
    doc_hash = "0x" + hashlib.sha256(content).hexdigest()

    d = Document(
        shipment_id=1,
        doc_index=0,
        doc_type=1,
        content_hash=doc_hash,
        cid="QmTestCidDocOriginal",
        filename="bol.txt",
        size_bytes=len(content),
        uploader=wallets["shipper"].address.lower(),
        block_number=1,
        block_time=1750000000,
        tx_hash="0x" + "22" * 32,
        log_index=0,
    )
    db_session.add(d)
    db_session.commit()
    return content, doc_hash


def test_document_upload_authorized_shipper(client, wallets, db_session):
    setup_shipment_with_doc(db_session, wallets)
    headers = auth_header_for(client, db_session, wallets["shipper"], role=2)

    file_content = b"Commercial Invoice invoice_101.pdf"
    expected_hash = "0x" + hashlib.sha256(file_content).hexdigest()

    files = {"file": ("invoice.pdf", io.BytesIO(file_content), "application/pdf")}
    data = {"shipmentId": 1, "docType": 0}

    resp = client.post("/api/v1/documents/upload", files=files, data=data, headers=headers)
    assert resp.status_code == 200
    res_data = resp.json()
    assert res_data["sha256"].lower() == expected_hash.lower()
    assert res_data["size"] == len(file_content)
    assert res_data["filename"] == "invoice.pdf"
    assert "cid" in res_data


def test_document_upload_unauthorized_party(client, wallets, db_session):
    setup_shipment_with_doc(db_session, wallets)
    # Transporter cannot upload documents in CargoChain (only Shipper and Inspector)
    headers = auth_header_for(client, db_session, wallets["transporter"], role=3)

    files = {"file": ("unauth.pdf", io.BytesIO(b"data"), "application/pdf")}
    data = {"shipmentId": 1, "docType": 0}

    resp = client.post("/api/v1/documents/upload", files=files, data=data, headers=headers)
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


def test_document_verify_matching_file(client, wallets, db_session):
    content, doc_hash = setup_shipment_with_doc(db_session, wallets)
    receiver_headers = auth_header_for(client, db_session, wallets["receiver"], role=6)

    # Receiver uploads the exact authentic file to verify
    files = {"file": ("bol.txt", io.BytesIO(content), "text/plain")}
    data = {"shipmentId": 1, "docIndex": 0}

    resp = client.post("/api/v1/documents/verify", files=files, data=data, headers=receiver_headers)
    assert resp.status_code == 200
    res = resp.json()
    assert res["match"] is True
    assert res["expectedHash"].lower() == doc_hash.lower()
    assert res["computedHash"].lower() == doc_hash.lower()


def test_document_verify_tampered_file(client, wallets, db_session):
    content, doc_hash = setup_shipment_with_doc(db_session, wallets)
    receiver_headers = auth_header_for(client, db_session, wallets["receiver"], role=6)

    tampered_content = b"Tampered Bill of Lading with forged quantity"
    files = {"file": ("bol.txt", io.BytesIO(tampered_content), "text/plain")}
    data = {"shipmentId": 1, "docIndex": 0}

    resp = client.post("/api/v1/documents/verify", files=files, data=data, headers=receiver_headers)
    assert resp.status_code == 200
    res = resp.json()
    assert res["match"] is False
    assert res["expectedHash"].lower() == doc_hash.lower()
    assert res["computedHash"].lower() != doc_hash.lower()


def test_document_proxy_download_and_authorization(client, wallets, db_session):
    content, doc_hash = setup_shipment_with_doc(db_session, wallets)
    receiver_headers = auth_header_for(client, db_session, wallets["receiver"], role=6)
    outsider_headers = auth_header_for(client, db_session, wallets["outsider"], role=2)

    # Write file to local cache so proxy can fetch it
    from app.services.ipfs import LOCAL_CACHE_DIR
    import os
    with open(os.path.join(LOCAL_CACHE_DIR, "QmTestCidDocOriginal"), "wb") as f:
        f.write(content)

    # Authorized receiver download -> 200
    resp_ok = client.get("/api/v1/documents/QmTestCidDocOriginal", headers=receiver_headers)
    assert resp_ok.status_code == 200
    assert resp_ok.content == content

    # Unauthorized outsider download -> 403
    resp_unauth = client.get("/api/v1/documents/QmTestCidDocOriginal", headers=outsider_headers)
    assert resp_unauth.status_code == 403
    assert resp_unauth.json()["error"]["code"] == "FORBIDDEN"


def test_document_upload_exceeds_size_limit(client, wallets, db_session, monkeypatch):
    setup_shipment_with_doc(db_session, wallets)
    headers = auth_header_for(client, db_session, wallets["shipper"], role=2)

    from app.config import settings
    # Set limit to 1 MB for testing
    monkeypatch.setattr(settings, "max_upload_mb", 1)

    oversized_content = b"X" * (1024 * 1024 + 1024)  # 1 MB + 1 KB
    files = {"file": ("large_doc.bin", io.BytesIO(oversized_content), "application/octet-stream")}
    data = {"shipmentId": 1, "docType": 0}

    resp = client.post("/api/v1/documents/upload", files=files, data=data, headers=headers)
    assert resp.status_code == 413
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"
    assert "exceeds" in resp.json()["error"]["message"].lower()


def test_unanchored_cid_download_rejected_for_non_admin(client, wallets, db_session):
    setup_shipment_with_doc(db_session, wallets)
    receiver_headers = auth_header_for(client, db_session, wallets["receiver"], role=6)

    # CID does not exist in DB documents
    resp = client.get("/api/v1/documents/QmUnanchoredArbitraryCID12345", headers=receiver_headers)
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"


def test_cid_not_found_on_ipfs_or_cache(client, wallets, db_session):
    content, doc_hash = setup_shipment_with_doc(db_session, wallets)
    receiver_headers = auth_header_for(client, db_session, wallets["receiver"], role=6)

    # Document QmTestCidDocOriginal is anchored in DB for shipment 1,
    # but ensure it is removed from local cache directory and IPFS is unreachable
    from app.services.ipfs import LOCAL_CACHE_DIR
    import os
    cache_path = os.path.join(LOCAL_CACHE_DIR, "QmTestCidDocOriginal")
    if os.path.exists(cache_path):
        os.remove(cache_path)

    resp = client.get("/api/v1/documents/QmTestCidDocOriginal", headers=receiver_headers)
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"
    assert "not found on ipfs or local store" in resp.json()["error"]["message"].lower()
