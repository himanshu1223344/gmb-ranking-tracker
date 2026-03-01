from flask import Flask
import threading
import asyncio
import os

app = Flask(__name__)

@app.route('/')
def home():
    return "GMB Ranking Tracker is Running ✅"

def run_bot():
    from bot import main
    asyncio.run(main())

t = threading.Thread(target=run_bot, daemon=True)
t.start()

if __name__ == '__main__':
    app.run()
