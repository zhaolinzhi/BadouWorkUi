/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * standalone(直接 `vite dev` 打开 7991)时的内存假 bridge
 *
 * 背景
 * ====
 * meeting-recording 的数据通道是宿主注入的 `window.ipcBridge.meetingRecording`。
 * 独立运行时没有宿主(也没有 Electron 主进程),bridge 根本不存在 ——
 * `__qiankun__/ipc.ts` 的 resolver 会直接抛错。而 `RecordingListPage` 在
 * **挂载时**就 `await ipcBridge.meetingRecording.list.invoke()` 取列表,取不到就
 * 抛错,整页被 React error boundary 接管,报 "Unexpected Application Error!"。
 *
 * 做法
 * ====
 * 独立运行时由 `main.ts` 把这份假 bridge 装到 `window.ipcBridge` 上 ——
 * 相当于「自己当自己的宿主」。装完之后 resolver 的间接 eval 分支照样命中,
 * 页面正常渲染,录音 / 保存 / 转写都作用在内存数据上。
 *
 * 边界
 * ====
 * - 只在 dev 装(见 `main.ts` 里的 `import.meta.env.DEV` 判断):生产产物由宿主
 *   提供真 bridge,万一脱离宿主直接打开,宁可报错也不要拿假数据糊弄人。
 * - 宿主已经注入过 bridge 时不覆盖(见 `installStandaloneMockBridge`)。
 * - 数据只在内存里:刷新页面即回到种子数据。
 */
import type { MeetingRecording, RecordingChunk } from '@common/types/meetingRecording';
import type { MeetingRecordingBridge } from './ipc';

/** 转写完成的模拟延迟:比真实转写快,但仍留出「进行中」的观感。 */
const TRANSCRIBE_DELAY_MS = 600;

/**
 * 造一段 0.125 秒的静音 WAV(8kHz / 8bit / 单声道)并 base64 编码。
 *
 * 种子录音要能被播放 —— 播放走的是 `readChunk` 返回的 base64,给一段真实可解码的
 * WAV,列表项点开才有声音(静音)而不是报错。
 */
function createSilentWavBase64(): string {
  const sampleRate = 8000;
  const sampleCount = 1000; // 0.125 秒
  const dataSize = sampleCount;
  const buffer = new Uint8Array(44 + dataSize);

  const view = new DataView(buffer.buffer);
  const writeAscii = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk 大小
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // 单声道
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true); // byte rate(8bit 单声道 = 采样率)
  view.setUint16(32, 1, true); // block align
  view.setUint16(34, 8, true); // 位深
  writeAscii(36, 'data');
  view.setUint32(40, dataSize, true);
  buffer.fill(128, 44); // 8bit PCM 的「静音」电平是 128

  let binary = '';
  for (const byte of buffer) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** 种子数据:一条已经转写完的录音,够把列表 / 详情 / 播放都点一遍。 */
function createSeedRecordings(): {
  recordings: MeetingRecording[];
  /** 录音 id → 各分片的 base64 音频(真实录音时由 save 带进来)。 */
  chunkAudio: Map<string, Map<number, string>>;
} {
  const base64 = createSilentWavBase64();
  const chunk: RecordingChunk = {
    index: 0,
    durationMs: 125,
    audioUrl: '',
    transcription: 'Standalone dev mock transcription — 静音音频,听不出声音。',
    status: 'transcribed',
  };
  const recordings: MeetingRecording[] = [
    {
      id: 'mr_mock_1',
      name: 'Standalone dev 录音',
      createdAt: Date.parse('2026-01-01T00:00:00.000Z'),
      mimeType: 'audio/wav',
      durationMs: 125,
      chunks: [chunk],
    },
  ];
  const chunkAudio = new Map<string, Map<number, string>>([['mr_mock_1', new Map([[0, base64]])]]);
  return { recordings, chunkAudio };
}

/** 内存里的假 bridge。方法签名与 `__qiankun__/ipc.ts` 声明的 `MeetingRecordingBridge` 对齐。 */
export function createStandaloneMockBridge(): { meetingRecording: MeetingRecordingBridge } {
  const { recordings, chunkAudio } = createSeedRecordings();
  /** 转写进度事件的订阅者。 */
  const chunkListeners = new Set<
    (payload: {
      id: string;
      chunkIndex: number;
      status: 'transcribed' | 'failed';
      transcription?: string;
      error?: string;
    }) => void
  >();

  const findRecording = (id: string): MeetingRecording | undefined => recordings.find((r) => r.id === id);

  const emitChunk = (payload: {
    id: string;
    chunkIndex: number;
    status: 'transcribed' | 'failed';
    transcription?: string;
    error?: string;
  }): void => {
    for (const listener of chunkListeners) listener(payload);
  };

  return {
    meetingRecording: {
      list: {
        // 深一层拷贝分片:真 bridge 的数据是跨进程结构化克隆过去的,调用方改不到
        // 宿主那一份。内存假 bridge 也照这个语义来,免得"改列表"意外改坏种子数据。
        invoke: async () => recordings.map((r) => ({ ...r, chunks: r.chunks.map((c) => ({ ...c })) })),
      },
      save: {
        invoke: async (params) => {
          const recording: MeetingRecording = {
            id: params.id,
            name: params.name,
            createdAt: Date.now(),
            mimeType: params.mimeType,
            durationMs: params.chunks.reduce((sum, c) => sum + c.durationMs, 0),
            chunks: params.chunks.map((c) => ({
              index: c.index,
              durationMs: c.durationMs,
              audioUrl: '',
              transcription: '',
              status: 'pending' as const,
            })),
          };
          recordings.unshift(recording);
          const audio = new Map<number, string>();
          params.chunks.forEach((c) => audio.set(c.index, c.audioBase64));
          chunkAudio.set(recording.id, audio);
          return recording;
        },
      },
      delete: {
        invoke: async ({ id }) => {
          const index = recordings.findIndex((r) => r.id === id);
          if (index >= 0) recordings.splice(index, 1);
          chunkAudio.delete(id);
          return { ok: true as const };
        },
      },
      transcribe: {
        invoke: async ({ id }) => {
          const recording = findRecording(id);
          if (!recording) throw new Error(`[meeting-recording standalone mock] recording "${id}" not found`);
          // 模拟异步转写:先标 pending,稍后广播 transcribed 事件
          setTimeout(() => {
            for (const chunk of recording.chunks) {
              if (chunk.status === 'transcribed') continue;
              chunk.status = 'transcribed';
              chunk.transcription = 'Standalone dev mock transcription.';
              emitChunk({
                id: recording.id,
                chunkIndex: chunk.index,
                status: 'transcribed',
                transcription: chunk.transcription,
              });
            }
          }, TRANSCRIBE_DELAY_MS);
          return { id };
        },
      },
      cancelTranscribe: {
        invoke: async ({ id }) => {
          const recording = findRecording(id);
          if (!recording) throw new Error(`[meeting-recording standalone mock] recording "${id}" not found`);
          for (const chunk of recording.chunks) {
            if (chunk.status !== 'pending') continue;
            chunk.status = 'failed';
            chunk.error = 'Standalone dev mock: 转写已取消';
            emitChunk({ id: recording.id, chunkIndex: chunk.index, status: 'failed', error: chunk.error });
          }
          return { ok: true as const };
        },
      },
      readChunk: {
        invoke: async ({ id, chunkIndex }) => {
          const recording = findRecording(id);
          if (!recording) throw new Error(`[meeting-recording standalone mock] recording "${id}" not found`);
          const mimeType = recording.mimeType || 'audio/webm';
          const base64 = chunkAudio.get(id)?.get(chunkIndex) ?? '';
          return { base64, mimeType };
        },
      },
      chunkTranscribed: {
        on: (handler) => {
          chunkListeners.add(handler);
          return () => {
            chunkListeners.delete(handler);
          };
        },
      },
    },
  };
}

/**
 * 把内存假 bridge 装到 `window.ipcBridge` 上。
 *
 * 宿主(shell)已经注入过 bridge 时**不覆盖** —— 真数据优先。
 *
 * @returns 是否真的装上了(没装 = 宿主已经有真 bridge,或不在浏览器环境)。
 */
export function installStandaloneMockBridge(): boolean {
  if (typeof window === 'undefined') return false;
  const carrier = window as unknown as { ipcBridge?: Record<string, unknown> };
  const existing = carrier.ipcBridge;
  if (existing && existing.meetingRecording) return false;

  const bridge = createStandaloneMockBridge();
  // `...existing`:existing 是 undefined 时展开也不会报错(等价于展开空对象)
  carrier.ipcBridge = { ...existing, ...bridge };
  // eslint-disable-next-line no-console
  console.info('[meeting-recording] standalone dev: using in-memory mock bridge');
  return true;
}
