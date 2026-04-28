from pymongo import MongoClient

client = None
db = None
patients_col = None
users_col = None
pending_reg_col = None


def init_db(mongo_uri: str) -> None:
    global client, db, patients_col, users_col, pending_reg_col
    client = MongoClient(mongo_uri)
    db = client["vadr_db"]
    patients_col = db["patients"]
    users_col = db["users"]
    pending_reg_col = db["registration_pending"]
