from flask import Flask, jsonify
from flask import request
from api.downloader import download_subtitles
from api.crypto import decrypt_text
import logging
import os

logger = logging.getLogger(__name__)

app = Flask(__name__)


@app.errorhandler(Exception)
def handle_exception(e):
    logger.error(f"Unhandled exception: {str(e)}")
    return jsonify({"err": str(e)}), 500


@app.route("/api/subtitle")
def get_subtitle():
    try:
        url = request.args.get("url")
        username = request.args.get("username")
        password = request.args.get("password")

        # Decrypt credentials if present
        if username:
            username = decrypt_text(username)
        if password:
            password = decrypt_text(password)

        logger.info(f"Received subtitle request for URL: {url}")

        if not url:
            logger.error("Missing URL parameter")
            return jsonify({"err": "URL is required"}), 400

        split_by_chapter = request.args.get("split_by_chapter", "false").lower() == "true"
        prefer_chinese = request.args.get("prefer_chinese", "false").lower() == "true"

        subtitle_paths = download_subtitles(
            url,
            split_by_chapter=split_by_chapter,
            prefer_chinese=prefer_chinese,
            username=username,
            password=password,
        )

        if not subtitle_paths:
            logger.warning(f"No subtitles found for URL: {url}")
            return jsonify({"err": "No subtitles found for this video"}), 404

        logger.info(f"Successfully processed subtitles for URL: {url}")

        files = []
        for path in subtitle_paths:
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
                filename = os.path.basename(path)
                files.append({"name": filename, "content": content})

        return jsonify({"data": {"files": files}})
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        raise
