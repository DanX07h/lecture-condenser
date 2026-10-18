# Lecture Condenser

A first local prototype for turning lectures and course documents into concise study notes.

## Start

Requires Node.js 22 or newer.

```sh
npm ci --cache /tmp/lecture-npm-cache
cp .env.example .env
# Set AI_PROVIDER=groq and add your replacement GROQ_API_KEY to .env using a local editor.
npm run dev
```

Open port 3000 in your local browser. Sample notes work without an API key. Groq uses whisper-large-v3-turbo for transcription and llama-3.3-70b-versatile for notes. Its free tier is subject to account, model and rate limits; free credits are not guaranteed. To use OpenAI instead, set AI_PROVIDER=openai and OPENAI_API_KEY (paid API usage). NOTES_MODEL optionally overrides the notes model. The key stays on the server. Run `npm test` for extraction checks.

## Current scope

Accepts audio (MP3, M4A, WAV, MP4, WEBM, MPEG, MPGA), text-based PDF, DOCX, PPTX and TXT. Upload a lecture/document and optionally one supporting document. Notes can be downloaded as Markdown. Each file is limited to 24 MB; combined extracted text is limited to 180,000 characters. Files are held in memory during a request and are not deliberately saved to disk. Source content is sent to the selected provider; review provider retention policies before using sensitive material.

This is a local prototype, not a production deployment. It has no accounts, authentication, rate limits, persistent jobs, OCR, diagram understanding, reliable timestamp citations, or two-hour recording support. Keep it private. AI output needs source review. Legacy .doc/.ppt files must first be exported to DOCX/PPTX or PDF.

## Next milestones

1. Validate notes against 5–10 permitted lectures and measure omissions, accuracy, time and cost.
2. Add authenticated direct uploads to private object storage and durable background jobs with progress and retries.
3. Split long recordings into overlapping chunks, preserve timestamps, then merge topic notes with a whole-lecture coverage pass.
4. Add source-linked citations, OCR and slide image understanding.
5. Add deletion/retention controls, quotas and billing before opening the service to others.
