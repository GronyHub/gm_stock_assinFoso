# Real-app guide videos

`record.js` records a page guide from the REAL app: it drives the app in a phone-sized browser, shows a finger marker,
tap ripples and step captions (`overlay.js`), types and taps through the procedure, and lays the British narration
(Piper `en_GB-alba-medium`) over it. No database is involved:

- the app runs with a dummy `DATABASE_URL` (it can't reach anything) and a local `AUTH_SECRET`;
- the recorder signs in with a session token minted from that secret (`next-auth/jwt` `encode`, cookie `authjs.session-token`);
- every `/api/...` request is answered with made-up data from `sample.js` (customers, sales, records are all invented).

Each guide is a scenario in `scenarios/<key>.js` (a list of steps: caption, narration, and what to tap).

```bash
npx next build && AUTH_SECRET=... DATABASE_URL=postgresql://x:x@127.0.0.1:1/x AUTH_TRUST_HOST=true SMS_ENABLED=off npx next start -p 3005
SESSION_TOKEN_FILE=token.txt VOICE=en_GB-alba-medium.onnx node docs/guides/real/record.js log out.mp4
```

Needs Playwright, ffmpeg and `piper-tts`. Service workers are blocked while recording so every request is answered by the recorder.
