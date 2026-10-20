# Lecture Condenser

A first local prototype for turning lectures and course documents into concise study notes.

## Start

Requires Node.js 22 or newer. Automatic media compression also requires FFmpeg. On macOS with Homebrew installed, run `brew install ffmpeg`.

```sh
npm ci --cache /tmp/lecture-npm-cache
cp .env.example .env
# Set AI_PROVIDER=groq and add your replacement GROQ_API_KEY to .env using a local editor.
npm run dev
```

Open port 3000 in your local browser. Sample notes work without an API key. Groq uses whisper-large-v3-turbo for transcription and llama-3.3-70b-versatile for notes. Its free tier is subject to account, model and rate limits; free credits are not guaranteed. To use OpenAI instead, set AI_PROVIDER=openai and OPENAI_API_KEY (paid API usage). NOTES_MODEL optionally overrides the notes model. The key stays on the server. Run `npm test` for extraction checks.

## Current scope

Accepts audio (MP3, M4A, WAV, MP4, WEBM, MPEG, MPGA, MOV, MKV), text-based PDF, DOCX, PPTX and TXT. Upload a lecture/document and optionally one supporting document. Notes can be downloaded as Markdown. Recordings can be up to 500 MB, and documents up to 24 MB. Videos and audio larger than 24 MB are converted by FFmpeg to 24 kbps mono MP3 at 16 kHz. This discards video and favours speech over music; slides should be uploaded separately. Already-small audio is sent unchanged. Compressed audio must fit within 24 MB, otherwise the app asks for shorter recordings without truncating the source. Combined extracted text is limited to 180,000 characters. Uploads and compressed audio use a unique temporary directory deleted after the request, including normal error responses. A hard process kill can leave temporary files; use OS temporary-file cleanup if needed. Source content is sent to the selected provider; review provider retention policies before using sensitive material.

This is a local prototype, not a production deployment. It has no accounts, authentication, rate limits, persistent jobs, OCR, diagram understanding, reliable timestamp citations, or guaranteed two-hour recording support. Keep it private. AI output needs source review. Legacy .doc/.ppt files must first be exported to DOCX/PPTX or PDF.

## Next milestones

1. Validate notes against 5–10 permitted lectures and measure omissions, accuracy, time and cost.
2. Add authenticated direct uploads to private object storage and durable background jobs with progress and retries.
3. Split long recordings into overlapping chunks, preserve timestamps, then merge topic notes with a whole-lecture coverage pass.
4. Add source-linked citations, OCR and slide image understanding.
5. Add deletion/retention controls, quotas and billing before opening the service to others.

## Diagnosing provider errors

Run `npm run check:ai` to check whether the configured transcription and notes models are listed for your account. This reads the provider model listing without uploading files or printing the key. A listed model still may have rate limits or require account permissions when invoked. The app reports the failing stage, model, HTTP status and a sanitized provider error code. You can set `TRANSCRIPTION_MODEL` and `NOTES_MODEL` in your private `.env` to supported models shown in your provider console, then restart the app. Never share your `.env` or API key.

Compression reduces file size, not API token or duration limits. Two hours of audio at 24 kbps is approximately 22 MB, but provider quotas, request timeouts and transcript limits can still prevent processing. FFmpeg compression has a ten-minute timeout; each AI request has a three-minute timeout. No audio chunking or persistent background jobs are implemented yet.

## Slides to notes

The dedicated Slides to notes section accepts one to five PPTX or text-based PDF decks (24 MB each). It creates one study guide organised by topic, asks the model to merge repetition and retain unique points, highlights key information, and asks for source/deck citations. Actual PPTX slide numbers are passed to the model; PDF slide numbers are not currently extracted. Image-only decks are rejected when no text is available. Diagrams and speaker notes are not interpreted, and citations/output should be checked against the originals. Export legacy .ppt files as .pptx first. FFmpeg is not needed for this document-only workflow; an AI key and provider quota are still required. Combined text and provider context limits still apply across all decks.

## Topic folders and saved notes

The Folders & notes workspace stores notes in browser localStorage, grouped into topic folders. Generate notes or open the sample, edit the title and choose a folder above the notes, then click Save to folder. Open a saved note and change its folder, then Update saved note to move it. You can create/rename/delete folders, delete individual notes with confirmation, or write/paste your own Markdown notes. Deleting a folder keeps its notes under Unfiled.

Notes persist only in the same browser profile at the same web origin (scheme, host and port); a different port or browser has a separate library. They are not synced to GitHub or stored with the server. Clearing browser data removes them; download important notes as Markdown for backup. Private browsing and browser storage quotas may prevent saving; the app reports save failures rather than claiming success. An unrecognised or corrupt existing library is preserved rather than overwritten.

## Personal flashcards

Use the fixed Create flashcard button while reading notes. Highlight a passage in the displayed notes before opening the editor to prefill the answer, or write both the question and answer yourself. Choose an existing flashcard folder and save. The non-modal editor lets you keep reading while writing. Flashcards has its own folders, Show answer / Hide answer for revision, and Edit / move for updates. Note-folder counts include only notes. Flashcard folders are independent; deleting a folder keeps its own items in Unfiled. Flashcards use the same browser-only storage as notes, with no AI request or API charge. Existing saved libraries gain an empty flashcard collection without replacing notes or folders; browser data deletion also removes cards.

## Dashboard navigation

The app opens on an overview dashboard with saved-item counts and shortcuts. Use the persistent navigation to switch between Lecture notes, Slide decks, My notes and Flashcards; on mobile all six navigation choices appear in a compact grid. Only the selected workspace is displayed. Generating or opening notes opens the reading view inside My notes, and switching workspaces keeps current notes and form drafts in memory. Hash-based navigation supports browser back/forward and links such as `#library`. The Flashcards workspace has an independent topic filter and separate folders from the notes library. Saved notes and cards keep the same browser storage key; changing the dashboard layout does not migrate or erase them. Unsaved notes and drafts still do not survive a page reload.


## Back navigation and revision tests

The My notes reading view has a Back to saved notes link, returning to the previously selected notes folder. Lecture notes and slide-deck notes use note folders; personal flashcards use separate flashcard folders created in the Flashcards workspace. Existing shared folder names and IDs are copied to the flashcard folder collection on upgrade so old card associations survive; later renames and deletions are independent. The same browser storage key is retained, and changes persist on the next library write.

Under Flashcards → Test yourself, choose Saved notes or Saved flashcards, then select one or more folders. Note tests send only the selected notes to `/api/quiz`, use the configured provider/key to create up to 10 questions, and require API availability/quota. A test supports up to 50 notes and 180,000 combined characters; selecting fewer folders may be necessary for provider limits. Generated questions and answers need source review. Flashcard tests use all selected saved cards locally, with no AI call. Questions are shuffled; the user can type an answer, reveal the suggested answer and self-assess as known or needing practice. Results show self-assessed counts and allow retrying missed questions. Tests are temporary sessions and do not save generated questions, score history or progress after a page reload. Source notes and cards are not modified by tests.


## My notes workspace

Folders, saved-note browsing and reading now live together under My notes. Its default view lists folders and notes. Opening a saved note or generating a new study guide opens the detail view inside My notes; Back to saved notes returns to the same folder list. The separate Notes reader navigation item is removed. Switching views preserves folder selection and current notes in memory. Old `#reader` links still open the internal reading view, and the current reading route is `#library/note`. No saved data is moved or deleted by this UI change.

## Generation loading state

Submitting a lecture or slide-deck upload opens the My notes reading view with a prominent loading panel, animated spinner, selected filenames and elapsed time. The save controls are hidden while processing. This is an indeterminate indicator: it does not invent completion percentages or claim which server stage has finished. Successful generation replaces the panel with the study guide. Failure stops the spinner and shows an error and link back to the appropriate upload tool; any previous notes remain available below the error. The elapsed timer stops on success, failure or when another note is opened. Keep the browser tab open while a request is processing.
