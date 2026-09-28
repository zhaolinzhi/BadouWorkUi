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
  audio.webm | audio.mp4 | audio.ogg
  meta.json       # id, name, createdAt, durationMs, mimeType, transcription
```

## Replacing the placeholder transcription

The `transcribe` provider in
`packages/desktop/src/process/services/meetingRecording/index.ts` currently
writes a stub string. Swap its body for an HTTP call to the desired STT API
and persist the real text into `meta.json`. The IPC shape stays the same.
