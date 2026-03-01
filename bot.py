import os
import logging
import asyncio
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes
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
            await update.message.reply_text(
                f"✅ Result Found!\n"
                f"🌐 Website: {website}\n"
                f"🔑 Keyword: {keyword}\n"
                f"📍 Position: #{position}"
            )
        else:
            await update.message.reply_text(
                f"❌ {website} not found in top 100 for '{keyword}'"
            )
    except Exception as e:
        await update.message.reply_text(f"Error: {str(e)}")

def main():
    application = Application.builder().token(TOKEN).build()
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("check", check))
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == "__main__":
    main()
