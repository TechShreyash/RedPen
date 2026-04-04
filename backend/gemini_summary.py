import os
import asyncio
import itertools
from google import genai
from dotenv import load_dotenv

# Load environment variables from .env file if it exists
load_dotenv()

async def process_single_message_async(message, client, semaphore):
    """Helper function to summarize a single message asynchronously."""
    if not message:
        return ""
        
    prompt = (
        "Convert this security finding into exactly ONE short title (3-6 words). "
        "Reply with ONLY that single title on one line. "
        "No alternatives, no 'or', no options, no explanation, no punctuation, no quotes. "
        "Name the exact technical flaw, e.g. Wildcard CORS Origin, Hardcoded JWT Secret, "
        "SQL Injection via String Format, Unverified JWT Signature. "
        "Banned words: Detected, Found, Identified, Insecure, Issue, Vulnerability, Policy, Alert, Allowed.\n\n"
        f"Finding: {message}"
    )
    try:
        # Use a semaphore to limit the number of concurrent API requests overall
        async with semaphore:
            # We use the asynchronous client methods via client.aio
            response = await client.aio.models.generate_content(
                model='gemma-3-4b-it',
                contents=prompt,
            )
            # Post-process: take only the first non-empty line to avoid "or" alternatives
            raw = response.text.strip()
            first_line = next((l.strip() for l in raw.splitlines() if l.strip()), raw)
            # Strip any leading/trailing quotes or punctuation the model might add
            return first_line.strip('"\' .')
    except Exception as e:
        print(f"Error calling Gemini API for message: {e}")
        return "Error generating summary"

async def get_gemini_summaries_async(data):
    """
    Takes a dictionary containing a 'results' array.
    Calls the Gemini API to summarize the 'message' field of each result concurrently using asyncio.
    Routes requests through multiple API keys in a round-robin fashion.
    """
    if not data or "results" not in data:
        return []

    # Get all available API keys from the environment
    api_keys = []
    # Adjust range based on how many keys you have (here we check 1 to 3)
    for i in range(1, 4):
        key = os.environ.get(f"GEMINI_API_KEY_{i}")
        if key and key != f"your_api_key_{i}_here" and not key.startswith("your_"): # Basic validation to skip placeholders
            api_keys.append(key)
            
    if not api_keys:
        print("Error: No GEMINI_API_KEY_x environment variables are set. Please add them to your .env file.")
        return []
    else:
        print(f"Loaded {len(api_keys)} API key(s) for load balancing.")

    # Initialize a pool of clients
    clients = [genai.Client(api_key=key) for key in api_keys]
    
    # Create an iterator to cycle through the clients round-robin
    client_cycle = itertools.cycle(clients)
    
    # Extract only the messages to form our input list
    messages = [item.get("message", "") for item in data.get("results", [])]
    
    # You can increase the semaphore limit depending on the total rate limit of your combined keys.
    # E.g., if each key supports 5 requests parallel, and you have 3 keys, 15 is safe.
    semaphore = asyncio.Semaphore(15)
    
    # Create asyncio tasks for all messages, passing the next client in the cycle for each
    tasks = [process_single_message_async(msg, next(client_cycle), semaphore) for msg in messages]
    
    # Run tasks concurrently. gather automatically maintains the return order!
    summaries = await asyncio.gather(*tasks)
    
    return list(summaries)


async def enrich_results_with_titles(data: dict) -> dict:
    """
    Takes the full scan results dict, summarises every result's 'message' in
    parallel via Gemini, and adds a 'title' key to each result.
    Returns the mutated dict.
    """
    results_list = data.get("results", [])
    if not results_list:
        return data

    summaries = await get_gemini_summaries_async(data)

    for item, title in zip(results_list, summaries):
        item["title"] = title

    return data


def main():
    # 1. Generate sample data items to test with
    base_messages = [
        "CORS policy allows any origin (using wildcard '*'). This is insecure and should be avoided.",
        "The JWT token is secured with a weak secret key which can be brute-forced easily by an attacker.",
        "The user input is concatenated directly into the SQL query without parameterization, leading to SQL Injection.",
        "The application reflects untrusted input back to the user without proper sanitization resulting in XSS.",
        "The MD5 hashing algorithm is cryptographically broken and should not be used for secure hashing."
    ]
    
    sample_data = {"results": []}
    
    # We'll use 15 for demonstration (enough to iterate through 3 keys a few times)
    for i in range(15):
        sample_data["results"].append({
            "check_id": f"dummy.check.{i}",
            "path": f"testApi/file_{i}.py",
            "message": base_messages[i % len(base_messages)],
            "severity": "WARNING"
        })
    
    print(f"Running sample data through Gemini (processing {len(sample_data['results'])} items, load balancing across keys)...")
    
    # 2. Execute the async function
    result_array = asyncio.run(get_gemini_summaries_async(sample_data))
    
    # 3. Print out results
    print("\nReturned Array of Summaries:")
    for i, summary in enumerate(result_array, 1):
        print(f"{i}. {summary}")

if __name__ == "__main__":
    main()
