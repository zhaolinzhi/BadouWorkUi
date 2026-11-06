/**
 * Vditor dev 资源中间件的测试
 *
 * 覆盖 `vite.config.ts` 里 `createVditorDevAssetsPlugin` 的行为:
 * 把 `/vditor/dist/**` 映射到 vditor 包的 dist 目录 —— 独立运行时(lute / 语言包 /
 * 图标)全靠它,否则 Vditor 初始化失败、编辑器整个不出现。
 *
 * 中间件挂在 connect 的 `use('/vditor/dist', handler)` 上,connect 会把路由前缀
 * 从 `req.url` 里剥掉,所以 handler 看到的 url 是 `/js/lute/lute.min.js` 这种
 * 相对 dist 根的路径 —— 测试里直接按这个形态喂 url。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { createVditorDevAssetsPlugin, resolveVditorDistDir } from '../../vite.config';

type Middleware = (req: { url?: string }, res: unknown, next: () => void) => void;

/** 假的 connect 响应:能收 header,也能当 writable 用(中间件往里 pipe 文件流)。 */
class FakeResponse extends PassThrough {
  headers: Record<string, string> = {};

  setHeader(name: string, value: string): this {
    this.headers[name.toLowerCase()] = value;
    return this;
  }
}

/** 取出插件里注册的中间件函数。 */
function mountMiddleware(distDir: string): Middleware {
  const plugin = createVditorDevAssetsPlugin({ distDir });
  let handler: Middleware | undefined;
  const server = {
    middlewares: {
      use: (_route: string, fn: Middleware) => {
        handler = fn;
      },
    },
  };
  const configure = plugin.configureServer as unknown as (server: unknown) => void;
  configure(server);
  if (!handler) throw new Error('插件没有注册中间件');
  return handler;
}

/** 发一次请求,返回响应内容与「是否落到了 next()」。 */
function request(
  handler: Middleware,
  url: string
): Promise<{ body: string; headers: Record<string, string>; fellThrough: boolean }> {
  return new Promise((resolve, reject) => {
    const res = new FakeResponse();
    let fellThrough = false;
    // 中间件把文件流 pipe 进响应,pipe 结束时会调 res.end() —— writable 侧的
    // 'finish' 才是「响应写完了」的信号(readable 侧的 'end' 要等数据被读走)。
    res.on('finish', () => {
      resolve({ body: res.read()?.toString() ?? '', headers: res.headers, fellThrough });
    });
    res.on('error', reject);
    handler({ url }, res, () => {
      fellThrough = true;
      resolve({ body: '', headers: res.headers, fellThrough });
    });
  });
}

describe('createVditorDevAssetsPlugin', () => {
  let distDir: string;

  beforeEach(() => {
    distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-vditor-'));
    fs.mkdirSync(path.join(distDir, 'js/lute'), { recursive: true });
    fs.mkdirSync(path.join(distDir, 'js/i18n'), { recursive: true });
    fs.mkdirSync(path.join(distDir, 'css/content-theme'), { recursive: true });
    fs.writeFileSync(path.join(distDir, 'js/lute/lute.min.js'), 'window.lute = 1;');
    fs.writeFileSync(path.join(distDir, 'js/i18n/zh_CN.js'), 'window.i18n = 1;');
    fs.writeFileSync(path.join(distDir, 'css/content-theme/light.css'), 'body{}');
  });

  afterEach(() => {
    fs.rmSync(distDir, { recursive: true, force: true });
  });

  it('serves the requested file with a javascript content type', async () => {
    const handler = mountMiddleware(distDir);

    const res = await request(handler, '/js/lute/lute.min.js');

    expect(res.fellThrough).toBe(false);
    expect(res.body).toBe('window.lute = 1;');
    expect(res.headers['content-type']).toBe('application/javascript');
  });

  it('serves css files with a css content type', async () => {
    const handler = mountMiddleware(distDir);

    const res = await request(handler, '/css/content-theme/light.css');

    expect(res.fellThrough).toBe(false);
    expect(res.headers['content-type']).toBe('text/css');
  });

  it('ignores the query string when locating the file', async () => {
    const handler = mountMiddleware(distDir);

    const res = await request(handler, '/js/i18n/zh_CN.js?v=20260101');

    expect(res.fellThrough).toBe(false);
    expect(res.body).toBe('window.i18n = 1;');
  });

  it('falls through when the file does not exist', async () => {
    const handler = mountMiddleware(distDir);

    const res = await request(handler, '/js/lute/missing.min.js');

    expect(res.fellThrough).toBe(true);
    expect(res.body).toBe('');
  });

  it('falls through for a directory request', async () => {
    const handler = mountMiddleware(distDir);

    const res = await request(handler, '/js/lute');

    expect(res.fellThrough).toBe(true);
  });

  it('rejects path traversal outside the dist directory', async () => {
    const outside = path.join(distDir, '..', 'secret.txt');
    fs.writeFileSync(outside, 'top secret');
    try {
      const handler = mountMiddleware(distDir);

      const res = await request(handler, '/../secret.txt');

      expect(res.fellThrough).toBe(true);
      expect(res.body).not.toContain('top secret');
    } finally {
      fs.rmSync(outside, { force: true });
    }
  });

  it('is a serve-only plugin so it never lands in the production bundle', () => {
    const plugin = createVditorDevAssetsPlugin({ distDir });

    expect(plugin.name).toBe('notes-vditor-dev-assets');
    expect(plugin.apply).toBe('serve');
  });
});

describe('resolveVditorDistDir', () => {
  it('finds the vditor package installed in the workspace', () => {
    const found = resolveVditorDistDir();

    expect(found).not.toBeNull();
    expect(found?.replace(/\\/g, '/')).toContain('vditor/dist');
  });
});
