import os
import logging
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
from scraper import check_ranking

logging.basicConfig(level=logging.INFO)

TOKEN = os.environ.get("TELEGRAM_TOKEN")

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "🔍 GMB Ranking Tracker Ready!\n\n"
        "Send me:\n"
        "/check keyword | website\n\n"
        "Example:\n"
        "/check dentist in mumbai | drsharmadental.com"
    )

async def check(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        args = " ".join(context.args)
        if "|" not in args:
            await update.message.reply_text("❌ Format: /check keyword | website")
            return
        keyword, website = args.split("|")
        keyword = keyword.strip()
        website = website.strip()
        await update.message.reply_text(f"⏳ Checking '{keyword}' for {website}...")
        position = check_ranking(keyword, website)
        if position:
            await update.message.reply_text(f"✅ {website}\nKeyword: {keyword}\nPosition: #{position}")
        else:
            await update.message.reply_text(f"❌ {website} not found in top 100 results for '{keyword}'")
    except Exception as e:
        await update.message.reply_text(f"Error: {str(e)}")

def main():
    app = Application.builder().token(TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("check", check))
    app.run_polling()

if __name__ == "__main__":
    main()
