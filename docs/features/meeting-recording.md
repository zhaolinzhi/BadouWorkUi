# Meeting Recording

Record microphone audio from a dedicated Sider page. Recordings persist to
`<userData>/meeting-recordings/<id>/` (one folder per take) and survive app
restarts. Transcription is a placeholder — the IPC contract is in place to
plug in a real STT backend later.

## Entry points

- Sider: "Meeting Recording" entry (between Notes and Workbench).
- Route: `/meeting-recording`.

## IPC contract

`ipcBridge.meetingRecording`:

| Key          | Params                | Result                                            |
| ------------ | --------------------- | ------------------------------------------------- |
| `list`       | `void`                | `MeetingRecording[]` (sorted by `createdAt` desc) |
| `save`       | `SaveRecordingParams` | `MeetingRecording`                                |
| `delete`     | `{ id }`              | `{ ok: true }`                                    |
| `transcribe` | `{ id }`              | `{ id, transcription }` (placeholder text today)  |

Audio bytes travel as `audioBase64` because the IPC channel is JSON-encoded
(`office-ai-bridge-adapter`).

## File layout

```
<userData>/meeting-recordings/<uuid>/
  meta.json              # id, name, createdAt, durationMs, mimeType, chunks[]
  chunks/
    000.webm | 000.mp4 | 000.ogg
    001.webm
    ...
```

Each entry in `chunks[]` has its own `status` (`pending` / `transcribed` /
`failed`) and `transcription`. The list UI renders one row per recording and
expands to show each chunk's status and inline `<audio>` player.

## Transcription

Recording audio is split into ≤50 s chunks at the browser via
`MediaRecorder.start(50_000)`. Each chunk is POSTed to the STT endpoint
sequentially from the main process:

```
POST http://extranet.badousoft.com:28021/v1/audio/transcriptions
multipart/form-data:
  file:           <chunk-XXX.webm>
  model:          whisper-large-v3
  language:       zh
  prompt:         <chinese-stt-prompt>
```

Chunk results are persisted into `meta.json` and pushed to the UI as
`chunkTranscribed` events. A failed chunk leaves the rest of the recording
intact — the UI shows that single chunk as "转写失败".

### Resilient upload

The main-process worker that walks the chunks applies two defenses against
transient upstream issues before the request hits the wire:

1. **EBML header repair** (`sttClient.repairWebmChunk`): some
   `MediaRecorder` timeslice implementations emit webm slices without the
   leading `EBML` / `Segment` / `Tracks` header after the first slice, which
   Whisper's ffmpeg decoder rejects with HTTP 400 "Invalid or unsupported
   audio file". The first chunk's first 4 KiB (which always carries the
   header) is detected via the EBML magic `0x1A 0x45 0xDF 0xA3` and
   prepended to any sibling chunk that's missing it. Non-webm recordings
   (mp4/ogg) skip this step — `extractWebmHeader` returns `null` and the
   raw bytes are sent through.
2. **Single retry on transient gateway errors**: 502 / 503 / 504 are retried
   once after 1.5 s. 4xx is never retried — a 400 means the request itself
   is malformed and a retry would only flood the upstream with the same bad
   payload.

To swap the endpoint: edit `sttClient.ts`. The IPC contract (`transcribe`,
`chunkTranscribed`) does not change.
