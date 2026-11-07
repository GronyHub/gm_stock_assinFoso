# Twi/Akan narration with Meta's MMS text-to-speech model: python twi_tts.py "text" out.wav
import sys, torch, scipy.io.wavfile as w
from transformers import VitsModel, AutoTokenizer
tok = AutoTokenizer.from_pretrained('facebook/mms-tts-aka'); m = VitsModel.from_pretrained('facebook/mms-tts-aka').eval()
with torch.no_grad(): y = m(**tok(sys.argv[1], return_tensors='pt')).waveform[0].numpy()
w.write(sys.argv[2], m.config.sampling_rate, y)
