from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGO_DB", "redpen")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Two collections
file_structures_col = db["file_structures"]
scan_results_col = db["scan_results"]
