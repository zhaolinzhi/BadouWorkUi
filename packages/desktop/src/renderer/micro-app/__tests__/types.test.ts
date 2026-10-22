import { describe, it, expect, expectTypeOf } from 'vitest';
import type { MicroAppProps } from '../types';
// 运行时 import 强制模块解析（import type 在 esbuild 转换时被擦除）
import * as TypesModule from '../types';

describe('MicroAppProps', () => {
  it('module exports the expected types', () => {
    // 强制 types.ts 存在并导出
    expect(TypesModule).toBeDefined();
  });

  it('has required user info fields', () => {
    expectTypeOf<MicroAppProps>().toHaveProperty('token');
    expectTypeOf<MicroAppProps>().toHaveProperty('userInfo');
    expectTypeOf<MicroAppProps>().toHaveProperty('systemCode');
    expectTypeOf<MicroAppProps>().toHaveProperty('baseApi');
    expectTypeOf<MicroAppProps>().toHaveProperty('shellVersion');
    expectTypeOf<MicroAppProps>().toHaveProperty('theme');
    expectTypeOf<MicroAppProps>().toHaveProperty('locale');
    expectTypeOf<MicroAppProps>().toHaveProperty('on');
    expectTypeOf<MicroAppProps>().toHaveProperty('emit');
    expectTypeOf<MicroAppProps>().toHaveProperty('navigate');
    expectTypeOf<MicroAppProps>().toHaveProperty('navigateExternal');
  });

  it('theme is light or dark', () => {
    expectTypeOf<MicroAppProps['theme']>().toEqualTypeOf<'light' | 'dark'>();
  });

  it('userInfo has required fields', () => {
    expectTypeOf<MicroAppProps['userInfo']>().toHaveProperty('id');
    expectTypeOf<MicroAppProps['userInfo']>().toHaveProperty('username');
    expectTypeOf<MicroAppProps['userInfo']>().toHaveProperty('permissions');
    expectTypeOf<MicroAppProps['userInfo']>().toHaveProperty('tenantId');
  });
});
