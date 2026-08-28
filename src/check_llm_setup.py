import os
from dotenv import load_dotenv

load_dotenv(override=True)

key = os.environ.get("GROQ_API_KEY")

if key:
    print(f"GROQ_API_KEY found. Length: {len(key)}. Starts with: {key[:6]}...")
else:
    print("GROQ_API_KEY was NOT found in environment. .env is not being loaded, or the key isn't set correctly.")

import sys
sys.path.insert(0, ".")
from diagnosis_llm import get_llm_client
client = get_llm_client()
print(f"Active LLM client: {type(client).__name__}")
