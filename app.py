from flask import Flask
import threading
from bot import main as bot_main

app = Flask(__name__)

@app.route('/')
def home():
    return "GMB Ranking Tracker is Running ✅"

def run_bot():
    bot_main()

# Start bot in background thread
t = threading.Thread(target=run_bot)
t.daemon = True
t.start()

if __name__ == '__main__':
    app.run()
