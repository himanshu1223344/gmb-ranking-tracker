import requests
from bs4 import BeautifulSoup
import time
import random

def check_ranking(keyword, website):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    query = keyword.replace(" ", "+")
    position = 0

    for page in range(0, 100, 10):
        url = f"https://www.google.com/search?q={query}&start={page}"
        try:
            response = requests.get(url, headers=headers, timeout=10)
            soup = BeautifulSoup(response.text, "html.parser")
            results = soup.select("div.g")

            for result in results:
                position += 1
                link = result.find("a")
                if link and website.lower() in link.get("href", "").lower():
                    return position

            time.sleep(random.uniform(2, 4))
        except Exception as e:
            print(f"Error: {e}")
            return None

    return None
