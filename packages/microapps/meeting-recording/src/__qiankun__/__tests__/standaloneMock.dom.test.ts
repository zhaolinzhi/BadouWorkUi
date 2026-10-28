/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * standalone 内存假 bridge 的单测
 *
 * 覆盖两件事:
 *   1. 假 bridge 的行为跟宿主那侧对齐(列表 / 保存 / 删除 / 转写 / 取消 / 读分片);
 *   2. 装上之后,`__qiankun__/ipc.ts` 的 resolver 能真的拿到它 ——
 *      这是「standalone dev 不再整页崩掉」的关键一环。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStandaloneMockBridge, installStandaloneMockBridge } from '../standaloneMock';

/** 种子录音的 id,见 `standaloneMock.ts` 的 `createSeedRecordings`。 */
const SEED_ID = 'mr_mock_1';

/** 保存一条录音所需的参数(音频内容对假 bridge 无意义,给个标记字符串即可)。 */
function makeSaveParams(id = 'mr_new_1') {
  return {
    id,
    name: 'New recording',
    mimeType: 'audio/webm',
    chunks: [
      { index: 0, durationMs: 1200, audioBase64: 'AAAA' },
      { index: 1, durationMs: 800, audioBase64: 'BBBB' },
    ],
  };
}

beforeEach(() => {
  // 转写是延时广播的,用假定时器把时间推过去,测试不必真的等 600ms。
  vi.useFakeTimers();
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).ipcBridge;
});

describe('createStandaloneMockBridge — 列表与删除', () => {
  it('lists the seeded recording', async () => {
    const { meetingRecording } = createStandaloneMockBridge();

    const list = await meetingRecording.list.invoke();

    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(SEED_ID);
    expect(list[0].chunks[0].status).toBe('transcribed');
  });

  it('hands out copies so callers cannot mutate the stored recording', async () => {
    const { meetingRecording } = createStandaloneMockBridge();

    const list = await meetingRecording.list.invoke();
    list[0].chunks[0].transcription = 'tampered';

    const again = await meetingRecording.list.invoke();
    expect(again[0].chunks[0].transcription).not.toBe('tampered');
  });

  it('serves decodable audio for the seeded chunk', async () => {
    const { meetingRecording } = createStandaloneMockBridge();

    const chunk = await meetingRecording.readChunk.invoke({ id: SEED_ID, chunkIndex: 0 });

    expect(chunk.mimeType).toBe('audio/wav');
    // WAV 文件头:RIFF....WAVE
    expect(atob(chunk.base64).slice(0, 4)).toBe('RIFF');
  });

  it('deletes a recording', async () => {
    const { meetingRecording } = createStandaloneMockBridge();

    await meetingRecording.delete.invoke({ id: SEED_ID });

    expect((await meetingRecording.list.invoke()).map((r) => r.id)).not.toContain(SEED_ID);
  });

  it('ignores deleting an unknown recording', async () => {
    const { meetingRecording } = createStandaloneMockBridge();

    await expect(meetingRecording.delete.invoke({ id: 'nope' })).resolves.toEqual({ ok: true });
    expect(await meetingRecording.list.invoke()).toHaveLength(1);
  });
});

describe('createStandaloneMockBridge — 保存与读分片', () => {
  it('adds a saved recording with pending chunks', async () => {
    const { meetingRecording } = createStandaloneMockBridge();

    const saved = await meetingRecording.save.invoke(makeSaveParams());

    expect(saved.chunks.map((c) => c.status)).toEqual(['pending', 'pending']);
    expect(saved.durationMs).toBe(2000);
    expect((await meetingRecording.list.invoke()).map((r) => r.id)).toContain('mr_new_1');
  });

  it('returns the stored audio for a saved chunk', async () => {
    const { meetingRecording } = createStandaloneMockBridge();
    await meetingRecording.save.invoke(makeSaveParams());

    const chunk = await meetingRecording.readChunk.invoke({ id: 'mr_new_1', chunkIndex: 1 });

    expect(chunk.base64).toBe('BBBB');
    expect(chunk.mimeType).toBe('audio/webm');
  });

  it('rejects reading a chunk of an unknown recording', async () => {
    const { meetingRecording } = createStandaloneMockBridge();

    await expect(meetingRecording.readChunk.invoke({ id: 'nope', chunkIndex: 0 })).rejects.toThrow(/not found/);
  });
});

describe('createStandaloneMockBridge — 转写', () => {
  it('rejects transcribing an unknown recording', async () => {
    const { meetingRecording } = createStandaloneMockBridge();

    await expect(meetingRecording.transcribe.invoke({ id: 'nope' })).rejects.toThrow(/not found/);
  });

  it('marks the chunks as transcribed once the simulated delay elapses', async () => {
    const { meetingRecording } = createStandaloneMockBridge();
    await meetingRecording.save.invoke(makeSaveParams());

    await meetingRecording.transcribe.invoke({ id: 'mr_new_1' });
    vi.advanceTimersByTime(600);

    const saved = (await meetingRecording.list.invoke()).find((r) => r.id === 'mr_new_1');
    expect(saved?.chunks.every((c) => c.status === 'transcribed')).toBe(true);
  });

  it('notifies chunkTranscribed subscribers when a chunk is transcribed', async () => {
    const { meetingRecording } = createStandaloneMockBridge();
    await meetingRecording.save.invoke(makeSaveParams());
    const events: { id: string; chunkIndex: number; status: string }[] = [];
    meetingRecording.chunkTranscribed.on((payload) => events.push(payload));

    await meetingRecording.transcribe.invoke({ id: 'mr_new_1' });
    vi.advanceTimersByTime(600);

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ id: 'mr_new_1', chunkIndex: 0, status: 'transcribed' });
  });

  it('stops notifying after the subscriber unsubscribes', async () => {
    const { meetingRecording } = createStandaloneMockBridge();
    await meetingRecording.save.invoke(makeSaveParams());
    const events: unknown[] = [];
    const off = meetingRecording.chunkTranscribed.on((payload) => events.push(payload));
    off();

    await meetingRecording.transcribe.invoke({ id: 'mr_new_1' });
    vi.advanceTimersByTime(600);

    expect(events).toHaveLength(0);
  });
});

describe('createStandaloneMockBridge — 取消转写', () => {
  it('rejects cancelling an unknown recording', async () => {
    const { meetingRecording } = createStandaloneMockBridge();

    await expect(meetingRecording.cancelTranscribe.invoke({ id: 'nope' })).rejects.toThrow(/not found/);
  });

  it('fails the pending chunks and reports it to subscribers', async () => {
    const { meetingRecording } = createStandaloneMockBridge();
    await meetingRecording.save.invoke(makeSaveParams());
    const events: { status: string; error?: string }[] = [];
    meetingRecording.chunkTranscribed.on((payload) => events.push(payload));

    await meetingRecording.cancelTranscribe.invoke({ id: 'mr_new_1' });

    const saved = (await meetingRecording.list.invoke()).find((r) => r.id === 'mr_new_1');
    expect(saved?.chunks.every((c) => c.status === 'failed')).toBe(true);
    expect(events[0].status).toBe('failed');
    expect(events[0].error).toBeTruthy();
  });
});

describe('installStandaloneMockBridge', () => {
  it('makes the bridge resolvable through the meetingRecording ipc accessor', async () => {
    expect(installStandaloneMockBridge()).toBe(true);

    // `ipc.ts` 会把解析到的 bridge 缓存在模块级变量里,所以这里重置模块注册表,
    // 保证拿到的是"装好假 bridge 之后"的新实例。
    vi.resetModules();
    const { ipcBridge } = await import('../ipc');

    const list = await ipcBridge.meetingRecording.list.invoke();
    expect(list).toHaveLength(1);
  });

  it('does not overwrite a bridge the host already installed', () => {
    const hostBridge = { list: { invoke: vi.fn() } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).ipcBridge = { meetingRecording: hostBridge };

    expect(installStandaloneMockBridge()).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((window as any).ipcBridge.meetingRecording).toBe(hostBridge);
  });

  it('is idempotent — installing twice keeps the first bridge', async () => {
    installStandaloneMockBridge();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const first = (window as any).ipcBridge.meetingRecording;

    installStandaloneMockBridge();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((window as any).ipcBridge.meetingRecording).toBe(first);
  });
});
