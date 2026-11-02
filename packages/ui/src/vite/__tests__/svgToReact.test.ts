/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SVG → React 组件的转换规则测试。
 *
 * 这些规则决定了定制图标能不能和 icon-park 图标「长得一样」——
 * 描边交给外层 `<svg>`、`viewBox` 原样保留、属性名驼峰化,
 * 少做一件就会重现「同一个 `AppIcon` 在主应用和微应用里不一样」的老问题。
 */
import { describe, expect, it } from 'vitest';

import { convertSvgToComponent } from '../svgToReact';

const convert = (svg: string, name = 'demo') => convertSvgToComponent(svg, { name, factoryImport: '../customIcons' });

describe('convertSvgToComponent', () => {
  it('生成一个导出图标组件的模块', () => {
    const { code } = convert('<svg viewBox="0 0 24 24"><path d="M4 12h16" /></svg>');

    expect(code).toContain("import React from 'react';");
    expect(code).toContain("import { createCustomIcon } from '../customIcons';");
    expect(code).toContain('export default createCustomIcon("demo"');
    expect(code).toContain('viewBox: "0 0 24 24"');
  });

  it('多个子元素包在 Fragment 里 —— 不能写成逗号表达式', () => {
    const { code } = convert('<svg viewBox="0 0 24 24"><path d="M0 0" /><path d="M1 1" /></svg>');

    // 逗号表达式 `() => (a, b)` 只返回最后一个 —— 那样多路径的图标就只剩一条线。
    expect(code).toContain('React.createElement(React.Fragment, null,');
    expect(code).toContain('"d": "M0 0"');
    expect(code).toContain('"d": "M1 1"');
  });

  it('删掉子元素上的描边属性 —— 它们由外层 svg 统一给', () => {
    const { code } = convert(
      '<svg viewBox="0 0 24 24"><path d="M4 12h16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>'
    );

    expect(code).not.toContain('"stroke"');
    expect(code).not.toContain('"stroke-width"');
    expect(code).not.toContain('"stroke-linecap"');
    expect(code).not.toContain('"stroke-linejoin"');
    expect(code).toContain('"d": "M4 12h16"');
  });

  it('stroke="none" 保留 —— 那是「这一笔不描边」的意思', () => {
    const { code } = convert('<svg viewBox="0 0 24 24"><path d="M4 12h16" stroke="none" /></svg>');

    expect(code).toContain('"stroke": "none"');
  });

  it('属性名改成 React 的驼峰写法', () => {
    const { code } = convert(
      '<svg viewBox="0 0 24 24"><clipPath id="c"><path d="M0 0h24v24H0z" fill-rule="evenodd" clip-path="url(#c)" /></clipPath></svg>'
    );

    expect(code).toContain('"clipPath"');
    expect(code).toContain('"fillRule": "evenodd"');
    expect(code).not.toContain('fill-rule');
    expect(code).not.toContain('clip-path');
  });

  it('描边比例取设计稿自己的值 —— strokeWidth={3} 复现设计稿', () => {
    const { code } = convert('<svg viewBox="0 0 24 24"><path d="M0 0" stroke-width="1.5" /></svg>');

    expect(code).toContain('strokeScale: 0.5');
  });

  it('设计稿没写描边宽度时不换算,交给默认值', () => {
    const { code } = convert('<svg viewBox="0 0 24 24"><path d="M0 0" /></svg>');

    expect(code).not.toContain('strokeScale');
  });

  it('根 svg 的 fill="none" 不写进选项(默认就是 none)', () => {
    const { code } = convert('<svg viewBox="0 0 24 24" fill="none"><path d="M0 0" /></svg>');

    expect(code).not.toContain('fill:');
  });

  it('根 svg 的 fill="currentColor" 写进选项', () => {
    const { code } = convert('<svg viewBox="0 0 24 24" fill="currentColor"><path d="M0 0" /></svg>');

    expect(code).toContain('fill: "currentColor"');
  });

  it('id 加前缀,url(#id) 的引用同步改写', () => {
    const { code } = convert(
      '<svg viewBox="0 0 24 24"><defs><linearGradient id="a"><stop offset="0" stop-color="#fff" /></linearGradient></defs><path d="M0 0" fill="url(#a)" /></svg>'
    );

    expect(code).toContain('"id": "demo-a"');
    expect(code).toContain('"fill": "url(#demo-a)"');
    expect(code).toContain('"stopColor": "#fff"');
  });

  it('style 属性转成对象', () => {
    const { code } = convert('<svg viewBox="0 0 24 24"><path d="M0 0" style="fill:#fff;stroke:none" /></svg>');

    expect(code).toContain('"style": { "fill": "#fff", "stroke": "none" }');
  });

  it('<text> 里的文字保留', () => {
    const { code } = convert('<svg viewBox="0 0 24 24"><text x="0" y="0">Hi</text></svg>');

    expect(code).toContain('"Hi"');
  });

  it('写死的颜色给出提示 —— 它不跟随主题', () => {
    const { warnings } = convert('<svg viewBox="0 0 24 24"><path d="M0 0" fill="#86909C" /></svg>');

    expect(warnings.join('\n')).toContain('#86909C');
  });

  it('currentColor 不算写死的颜色', () => {
    const { warnings } = convert('<svg viewBox="0 0 24 24"><path d="M0 0" fill="currentColor" /></svg>');

    expect(warnings).toHaveLength(0);
  });

  it('缺 viewBox 且没有宽高时报错', () => {
    expect(() => convert('<svg><path d="M0 0" /></svg>')).toThrow(/viewBox/);
  });

  it('没有 viewBox 但有宽高时按宽高推画布', () => {
    const { code } = convert('<svg width="20" height="20"><path d="M0 0" /></svg>');

    expect(code).toContain('viewBox: "0 0 20 20"');
  });

  it('根元素不是 svg 时报错', () => {
    expect(() => convert('<html><body /></html>')).toThrow(/svg/);
  });
});
