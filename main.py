import os
import yt_dlp
import logging
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, CallbackContext
import webvtt

# Enable logging
logging.basicConfig(format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO)
logger = logging.getLogger(__name__)

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
if not TOKEN:
    raise ValueError("No TELEGRAM_BOT_TOKEN found in environment variables")


def convert_subtitle(filename: str):
    vtt = webvtt.read(filename)
    paragraph_list = []
    current_paragraph = ""
    previous_time = 0
    for caption in vtt:
        now = caption.start_in_seconds
        text = caption.text.replace("\n", " ")
        if now - previous_time > 5:
            if current_paragraph != "":
                paragraph_list.append(current_paragraph)
            current_paragraph = text
            previous_time = now
        else:
            if current_paragraph != "":
                current_paragraph += " " + text
            else:
                current_paragraph = text
    return "\n".join(paragraph_list)


def download_subtitles(url: str) -> str:
    """Downloads subtitles from the given YouTube URL and returns the file path."""
    ydl_opts = {
        "writesubtitles": True,
        "writeautomaticsub": True,
        "skip_download": True,
        "subtitlesformat": "vtt",
        "outtmpl": "subtitles/%(id)s.%(ext)s",
        "quiet": True,
    }

    os.makedirs("subtitles", exist_ok=True)

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        logger.info(f"Extracting info for URL: {url}")
        info = ydl.extract_info(url)
        video_id = info.get("id")
        requested_subtitles = info.get("requested_subtitles")
        subtitle_info = next(iter(requested_subtitles.values()))
        subtitle_path = subtitle_info.get("filepath")

        if os.path.exists(subtitle_path):
            logger.info(f"Subtitles found: {subtitle_path}")
            with open(f"{video_id}.txt", "w") as f:
                f.write(convert_subtitle(subtitle_path))
            return f"{video_id}.txt"
        else:
            logger.warning("Subtitles not found.")
            return None


async def start(update: Update, context: CallbackContext) -> None:
    logger.info("Received /start command")
    await update.message.reply_text("Send me a YouTube link, and I'll fetch subtitles for you!")


async def handle_message(update: Update, context: CallbackContext) -> None:
    url = update.message.text.strip()
    logger.info(f"Received URL: {url}")
    await update.message.reply_text("Fetching subtitles... Please wait.")

    try:
        subtitle_path = download_subtitles(url)

        if subtitle_path:
            await update.message.reply_document(document=open(subtitle_path, "rb"))
            os.remove(subtitle_path)  # Clean up after sending
            logger.info("Subtitle sent and deleted")
        else:
            await update.message.reply_text("Sorry, subtitles couldn't be retrieved.")
    except Exception as e:
        logger.error(f"Error occurred: {e}")
        await update.message.reply_text("An error occurred while fetching subtitles. Please try again later.")


def main():
    app = Application.builder().token(TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    logger.info("Bot is starting...")
    app.run_polling()


if __name__ == "__main__":
    main()
