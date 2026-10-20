# Lecture Condenser

A first local prototype for turning lectures and course documents into concise study notes.

## Start

Requires Node.js 22 or newer. Automatic media compression also requires FFmpeg. On macOS with Homebrew installed, run `brew install ffmpeg`.

```sh
npm ci --cache /tmp/lecture-npm-cache
cp -n .env.example .env
# Set AI_PROVIDER=groq and add your replacement GROQ_API_KEY to .env using a local editor.
npm run dev
```

Open port 3000 in your local browser. Sample notes work without an API key. Groq uses whisper-large-v3-turbo for transcription and llama-3.3-70b-versatile for notes. Its free tier is subject to account, model and rate limits; free credits are not guaranteed. To use OpenAI instead, set AI_PROVIDER=openai and OPENAI_API_KEY (paid API usage). NOTES_MODEL optionally overrides the notes model. The key stays on the server. Run `npm test` for extraction checks.

## Current scope

Accepts audio/video (MP3, M4A, WAV, MP4, WEBM, MPEG, MPGA, MOV, MKV), text-based PDF, DOCX, PPTX and TXT. Recordings can be up to **two hours and 500 MB each**; documents up to 24 MB. Lecture notes remain text-only: video frames and diagrams are not analysed. Legacy .doc/.ppt files must be exported to DOCX/PPTX or PDF.

## Long lecture processing

Lecture uploads run as persistent background jobs. FFprobe checks duration and FFmpeg extracts 10-minute, 24 kbps mono speech sections with 10-second overlaps (13 sections for exactly two hours). Each section is transcribed separately, followed by detailed section notes and bounded consolidation passes. The final study guide asks the model to preserve concepts, formulas, examples and caveats, merge overlapping repetition and check section coverage. A deterministic list of processed source sections is appended. Time ranges identify audio sections; they are not word-level timestamps or proof of summary accuracy.

Progress reports real counts for transcription and section notes, followed by consolidation. The job banner provides View progress/Open notes, Retry unfinished step and Cancel/Dismiss. Once upload acceptance completes, you can switch features, reload or close the browser and return at the same origin. Keep the Node server/Mac running. Server restarts automatically resume queued/interrupted jobs from disk; failed jobs wait for a manual Retry. Completed transcriptions, summaries and merge passes are checkpointed so retry does not intentionally repeat successful steps. A crash between an API response and saving its checkpoint can repeat that one call. Provider keys are read at runtime and never written into job metadata. Only one worker/server may use a job folder at once.

Transient network errors, HTTP 5xx and rate limits receive at most three total attempts, using exponential backoff and Retry-After with a 60-second wait cap. Authentication errors and explicit insufficient-quota errors are not retried automatically. Each AI call retains a three-minute timeout; audio preparation allows ten minutes per section. Daily quotas, model access, context limits, output limits and provider uptime still apply. You can retry after fixing those prerequisites. This reduces failures caused by lecture length, but does not guarantee AI accuracy or unlimited free processing.

Validation includes a real two-hour synthetic audio file through FFmpeg and all 13 sections, using simulated AI responses, plus checkpoint/restart/retry tests. A full academic two-hour lecture has **not** been validated against a live AI account; compare important points with the original source.

### Job storage and privacy

Jobs are stored under `.lecture-jobs/` (ignored by Git), or `LECTURE_JOBS_DIR` if set. Active and failed jobs retain recordings, transcripts and section notes on local disk for recovery. On success, source audio, extracted text checkpoints and section files are removed, retaining job metadata and final notes. Cancel/Dismiss deletes that server-side job and its files; notes already saved to browser My notes are preserved. There is no timed job retention policy yet. Upload staging uses temporary directories and is cleaned after the request; a hard process kill can leave temporary staging files for OS cleanup.

The browser remembers the latest job ID in localStorage at the same origin. Clearing browser storage loses that recovery link; server job data is separate. Save the final result to a folder or download it before dismissing. This remains a **local single-user prototype without authentication**. Keep it private: anyone with access to the server can access job endpoints. Source content is sent to the selected AI provider; review its retention/data terms before uploading sensitive recordings.

## Next milestones

1. Evaluate 5–10 permitted real lectures for omissions, accuracy, time and API cost.
2. Add authentication, private object storage and a production worker/queue before hosting publicly.
3. Add OCR and slide graph/image understanding separately from text-only lecture processing.
4. Add automatic retention, per-user quotas and billing.

## Diagnosing provider errors

Run `npm run check:ai` to check whether the configured transcription and notes models are listed for your account. This reads the provider model listing without uploading files or printing the key. A listed model still may have rate limits or require account permissions when invoked. The app reports the failing stage, model, HTTP status and a sanitized provider error code. You can set `TRANSCRIPTION_MODEL` and `NOTES_MODEL` in your private `.env` to supported models shown in your provider console, then restart the app. Never share your `.env` or API key.

## Slides to notes

The dedicated Slides to notes section accepts one to five PPTX or text-based PDF decks (24 MB each). It creates one study guide organised by topic, asks the model to merge repetition and retain unique points, highlights key information, and asks for source/deck citations. Actual PPTX slide numbers are passed to the model; PDF slide numbers are not currently extracted. Image-only decks are rejected when no text is available. Diagrams and speaker notes are not interpreted, and citations/output should be checked against the originals. Export legacy .ppt files as .pptx first. FFmpeg is not needed for this document-only workflow; an AI key and provider quota are still required. Combined text and provider context limits still apply across all decks.

## Topic folders and saved notes

The My notes workspace stores notes in browser localStorage, grouped into topic folders. Generate notes or open the sample, edit the title and choose a folder above the notes, then click Save to folder. Use Create new folder beside the folder selector to create and automatically select a notes folder without leaving your current notes. Open a saved note and change its folder, then Update saved note to move it. You can create/rename/delete folders, delete individual notes with confirmation, or write/paste your own Markdown notes. Deleting a folder keeps its notes under Unfiled.

Notes persist only in the same browser profile at the same web origin (scheme, host and port); a different port or browser has a separate library. They are not synced to GitHub or stored with the server. Clearing browser data removes them; download important notes as Markdown for backup. Private browsing and browser storage quotas may prevent saving; the app reports save failures rather than claiming success. An unrecognised or corrupt existing library is preserved rather than overwritten.

## Personal flashcards

Use the fixed Create flashcard button while reading notes. Highlight a passage in the displayed notes before opening the editor to prefill the answer, or write both the question and answer yourself. Choose an existing flashcard folder and save. The non-modal editor lets you keep reading while writing. Flashcards has its own folders, Show answer / Hide answer for revision, and Edit / move for updates. Note-folder counts include only notes. Flashcard folders are independent; deleting a folder keeps its own items in Unfiled. Flashcards use the same browser-only storage as notes, with no AI request or API charge. Existing saved libraries gain an empty flashcard collection without replacing notes or folders; browser data deletion also removes cards.

## Dashboard navigation

The app opens on an overview dashboard with saved-item counts and shortcuts. Use the persistent navigation to switch between Lecture notes, Slide notes, My notes and Flashcards; on mobile all navigation choices appear in a compact grid. Only the selected workspace is displayed. Generating or opening notes opens the reading view inside My notes, and switching workspaces keeps current notes and form drafts in memory. Hash-based navigation supports browser back/forward and links such as `#library`. The Flashcards workspace has an independent topic filter and separate folders from the notes library. Saved notes and cards keep the same browser storage key; changing the dashboard layout does not migrate or erase them. Unsaved notes and drafts still do not survive a page reload.


## Back navigation and revision tests

The My notes reading view has a Back to saved notes link, returning to the previously selected notes folder. Lecture notes and slide-deck notes use note folders; personal flashcards use separate flashcard folders created in the Flashcards workspace. Existing shared folder names and IDs are copied to the flashcard folder collection on upgrade so old card associations survive; later renames and deletions are independent. The same browser storage key is retained, and changes persist on the next library write.

Under Flashcards → Test yourself, choose Saved notes or Saved flashcards, then select one or more folders. Note tests send only the selected notes to `/api/quiz`, use the configured provider/key to create up to 10 questions, and require API availability/quota. A test supports up to 50 notes and 180,000 combined characters; selecting fewer folders may be necessary for provider limits. Generated questions and answers need source review. Flashcard tests use all selected saved cards locally, with no AI call. Questions are shuffled; the user can type an answer, reveal the suggested answer and self-assess as known or needing practice. Results show self-assessed counts and allow retrying missed questions. Tests are temporary sessions and do not save generated questions, score history or progress after a page reload. Source notes and cards are not modified by tests.


## My notes workspace

Folders, saved-note browsing and reading now live together under My notes. Its default view lists folders and notes. Opening a saved note or generating a new study guide opens the detail view inside My notes; Back to saved notes returns to the same folder list. The separate Notes reader navigation item is removed. Switching views preserves folder selection and current notes in memory. Old `#reader` links still open the internal reading view, and the current reading route is `#library/note`. No saved data is moved or deleted by this UI change.

## Generation loading state

Submitting a lecture or slide-deck upload opens the My notes reading view with a prominent loading panel, animated spinner, selected filenames and elapsed time. The save controls are hidden while processing. This is an indeterminate indicator: it does not invent completion percentages or claim which server stage has finished. Successful generation replaces the panel with the study guide. Failure stops the spinner and shows an error and link back to the appropriate upload tool; any previous notes remain available below the error. The elapsed timer stops on success, failure or when another note is opened. Slide-note requests still require the tab to stay open. Lecture jobs continue in the background after upload acceptance and expose stage counts in the loading panel.

## Exiting revision tests

The sticky Exit test · Back to flashcards button is available throughout test setup, AI generation, active questions and results. It returns directly to My flashcards and clears temporary session progress without changing saved notes or cards. Exiting while AI questions are loading aborts the browser request; stale responses are ignored so an exited test cannot reopen. An AI request already submitted to the server/provider may still finish there.

## Moving the flashcard editor

Drag the flashcard window by its header to move it, and drag any of its four corner handles to resize it. The form scrolls inside smaller windows while the header and × close button remain available. The window is constrained to the viewport and adjusts when the screen size changes. The header and corner handles also support arrow keys (Shift for larger steps) when focused. Close with × or Escape. Window size/position are retained while the page is open, not after a reload.
