# Advert videos (Advert > Video page)

`render.py` makes the narrated adverts in `public/adverts/`: a tall version (720x1280, for TikTok / WhatsApp Status) and a square version (1080x1080, for the Facebook feed).

- **What each video says and shows** is in `scripts.py`: one entry per scene, with a heading, the list on screen, the words spoken and the photos. The item lists were taken from the shop's active items on 2026-11-06. When stock changes, edit the lists there and render again.
- **Voice:** Piper, British female voice `en_GB-alba-medium`, from huggingface.co/rhasspy/piper-voices. Install it with `pip install piper-tts`, then download `en_GB-alba-medium.onnx` and its `.onnx.json` into `voice/`, or set `VOICE=/path/to/model.onnx`.
- **Photos:** `photos/banner/` holds pictures cut from the shop banner. `photos/commons/` holds free-licence photos from Wikimedia Commons, and `credits.json` lists their authors and licences. The credit line is printed on each video's last scene, as the CC BY-SA licence requires.
- **Run:** `pip install piper-tts pillow`, with ffmpeg installed, then `python3 render.py [computers materials printing training software website media hiring main all]`. The videos go to `out/`; copy them into `public/adverts/`.
