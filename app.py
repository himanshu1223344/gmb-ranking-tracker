from flask import Flask
import threading
import asyncio
from bot import main as bot_main

app = Flask(__name__)

@app.route('/')
def home():
    return "GMB Ranking Tracker is Running ✅"

def run_bot():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(bot_main())

t = threading.Thread(target=run_bot, daemon=True)
t.start()

if __name__ == '__main__':
    app.run()
