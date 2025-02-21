import os
import downloader
import logging
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, CallbackContext

# Enable logging
logging.basicConfig(format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO)
logger = logging.getLogger(__name__)

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
if not TOKEN:
    raise ValueError("No TELEGRAM_BOT_TOKEN found in environment variables")

COOKIE_FILE = os.getenv("COOKIE_FILE")


async def start(update: Update, context: CallbackContext) -> None:
    logger.info("Received /start command")
    await update.message.reply_text("Send me a YouTube link, and I'll fetch subtitles for you!")


async def handle_message(update: Update, context: CallbackContext) -> None:
    url = update.message.text.strip()
    logger.info(f"Received URL: {url}")
    await update.message.reply_text("Fetching subtitles... Please wait.")

    try:
        subtitle_path = downloader.download_subtitles(url, COOKIE_FILE)

        if subtitle_path:
            await update.message.reply_document(document=open(subtitle_path, "rb"))
            os.remove(subtitle_path)  # Clean up after sending
            logger.info("Subtitle sent and deleted.")
        else:
            await update.message.reply_text("Sorry, subtitles couldn't be retrieved.")
    except Exception as e:
        logger.error(f"Error occurred: {e}")
        await update.message.reply_text(
            "An error occurred while fetching subtitles. Please try again later. Error: {e}"
        )


def main():
    app = Application.builder().token(TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    logger.info("Bot is starting...")
    app.run_polling()


if __name__ == "__main__":
    main()
