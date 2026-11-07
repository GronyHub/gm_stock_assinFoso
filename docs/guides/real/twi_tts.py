# Asante Twi narration (a VITS voice fine-tuned on Bible recordings; safetensors weights only, no remote code):
#   python twi_tts.py "text" out.wav        (TWI_MODEL env var picks another Hugging Face model)
import sys, os, torch, scipy.io.wavfile as w
from transformers import VitsModel, AutoTokenizer
MODEL = os.environ.get('TWI_MODEL', 'danieldzikunuofmarvel/mms-tts-asante-twi-bibletts')
tok = AutoTokenizer.from_pretrained(MODEL); m = VitsModel.from_pretrained(MODEL, use_safetensors=True).eval()
with torch.no_grad(): y = m(**tok(sys.argv[1], return_tensors='pt')).waveform[0].numpy()
w.write(sys.argv[2], m.config.sampling_rate, y)
