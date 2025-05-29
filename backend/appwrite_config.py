import os
from dotenv import load_dotenv
load_dotenv()

from appwrite.client import Client
from appwrite.services.databases import Databases
from appwrite.services.storage import Storage

client = Client()
client.set_endpoint(os.getenv("APPWRITE_ENDPOINT")) \
      .set_project(os.getenv("APPWRITE_PROJECT_ID")) \
      .set_key(os.getenv("APPWRITE_API_KEY")) \
      .set_self_signed(True)

storage = Storage(client)
database = Databases(client)
