import yt_dlp
import os
import webvtt
import logging
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)


def convert_subtitle(filename: str, chapter_start: float = None, chapter_end: float = None):
    """
    Converts a VTT file to a plain text file with paragraphs.
    Optional chapter_start and chapter_end parameters to filter by timestamp.
    """
    vtt = webvtt.read(filename)
    paragraph_list = []
    current_paragraph = ""
    previous_time = 0
    previous_sentence = ""

    for caption in vtt:
        now = caption.start_in_seconds

        # Skip if outside chapter bounds
        if chapter_start is not None and now < chapter_start:
            continue
        if chapter_end is not None and now > chapter_end:
            break

        sentences = caption.text.split("\n")

        # dedup sentences in caption
        while len(sentences) != 0 and sentences[0] == previous_sentence:
            sentences.pop(0)
        if len(sentences) == 0:
            continue
        previous_sentence = sentences[0]

        # join captions of interval less than 5 seconds into a paragraph
        text = " ".join(sentences)
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
    if current_paragraph != "":
        paragraph_list.append(current_paragraph)

    return "\n".join(paragraph_list)


def get_chapter_info(info: dict, chapter_name: str) -> tuple:
    """
    Extracts start and end time for a specific chapter.
    Returns (start_time, end_time) in seconds.
    """
    chapters = info.get("chapters", [])
    for i, chapter in enumerate(chapters):
        if chapter["title"].lower() == chapter_name.lower():
            start_time = chapter["start_time"]
            end_time = chapter["end_time"] if "end_time" in chapter else None
            if end_time is None and i + 1 < len(chapters):
                end_time = chapters[i + 1]["start_time"]
            return start_time, end_time
    return None, None


def sanitize_filename(filename: str) -> str:
    """Sanitize filename to be filesystem-friendly."""
    # Replace invalid characters with underscore
    invalid_chars = '<>:"/\\|?*'
    for char in invalid_chars:
        filename = filename.replace(char, "_")
    # Limit length and strip spaces
    return filename.strip()[:100]


def download_subtitles(url: str, cookie_contents: str = None, split_by_chapter: bool = False) -> list[str]:
    """Downloads subtitles from the given YouTube URL.

    Args:
        url: YouTube video URL
        cookie_contents: Optional cookie contents for private videos
        split_by_chapter: If True, splits subtitles by chapters

    Returns:
        list[str]: List of paths to subtitle files. Contains single item if split_by_chapter=False
    """
    logger.info(f"Starting subtitle download for URL: {url}")

    # Create a temporary directory
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_dir_path = Path(temp_dir)
        temp_subtitles_dir = temp_dir_path / "subtitles"
        temp_cache_dir = temp_dir_path / "cache"
        temp_subtitles_dir.mkdir(exist_ok=True)
        temp_cache_dir.mkdir(exist_ok=True)

        ydl_opts = {
            "writesubtitles": True,
            "writeautomaticsub": True,
            "skip_download": True,
            "subtitlesformat": "vtt",
            "outtmpl": str(temp_subtitles_dir / "%(id)s.%(ext)s"),
            "quiet": True,
            "cachedir": str(temp_cache_dir),
        }

        # Only add cookie handling if cookie_contents is provided
        if cookie_contents:
            temp_cookie_file = temp_dir_path / "cookies.txt"
            with open(temp_cookie_file, "w") as f:
                f.write(cookie_contents)
            ydl_opts["cookiefile"] = str(temp_cookie_file)

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                logger.info(f"Extracting info for URL: {url}")
                info = ydl.extract_info(url)
                video_title = sanitize_filename(info.get("title", ""))
                video_id = info.get("id")

                requested_subtitles = info.get("requested_subtitles")
                subtitle_info = next(iter(requested_subtitles.values()))
                subtitle_path = subtitle_info.get("filepath")

                if not os.path.exists(subtitle_path):
                    logger.error(f"No subtitles found for video ID: {video_id}")
                    return []

                logger.info(f"Successfully downloaded subtitles for video ID: {video_id}")
                output_dir = Path("/tmp/subtitles")
                output_dir.mkdir(parents=True, exist_ok=True)

                if not split_by_chapter:
                    output_path = output_dir / f"{video_title}.txt"
                    with open(output_path, "w") as f:
                        f.write(convert_subtitle(subtitle_path))
                    os.remove(subtitle_path)
                    return [str(output_path)]

                # Split by chapters
                chapters = info.get("chapters", [])
                if not chapters:
                    logger.warning("No chapters found, returning full subtitles")
                    output_path = output_dir / f"{video_title}.txt"
                    with open(output_path, "w") as f:
                        f.write(convert_subtitle(subtitle_path))
                    os.remove(subtitle_path)
                    return [str(output_path)]

                chapter_files = []
                for i, chapter in enumerate(chapters):
                    start_time = chapter["start_time"]
                    end_time = (
                        chapter["end_time"]
                        if "end_time" in chapter
                        else (chapters[i + 1]["start_time"] if i + 1 < len(chapters) else None)
                    )
                    chapter_name = chapter["title"].replace(" ", "_")
                    output_path = output_dir / f"{video_title}_{chapter_name}.txt"

                    with open(output_path, "w") as f:
                        f.write(convert_subtitle(subtitle_path, start_time, end_time))
                    chapter_files.append(str(output_path))

                os.remove(subtitle_path)
                return chapter_files

        except Exception as e:
            logger.error(f"Error downloading subtitles: {str(e)}")
            raise
