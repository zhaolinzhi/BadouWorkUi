/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 文档行左侧的文件类型图标。
 *
 * 为什么不用 `@aionui/ui` 的 `AppIcon`
 * ====================================
 * `AppIcon` 那套是**可着色的线性图标**（20×20、`currentColor` 描边）；
 * 而 `src/assets/svgs/` 里这批是 **200×200 的彩色美术稿**（Word 是蓝的、
 * Excel 是绿的……），颜色是画在图形里的，着不了色。
 *
 * 所以这里走 URL 导入 + `<img>` 渲染 —— 和设计稿 mockup 的做法一致
 * （`preview/file-icons.js` 的 `BadouFileIcons.src()`）。
 *
 * 「扩展名 → 类型」的映射表移植自设计稿的 `preview/file-icons.js`
 * （只取扩展名那部分 —— 我们的接口不给 MIME 类型）。
 */

import React from 'react';

import file3d from '../../assets/svgs/file-3d.svg';
import fileArchive from '../../assets/svgs/file-archive.svg';
import fileAudio from '../../assets/svgs/file-audio.svg';
import fileCode from '../../assets/svgs/file-code.svg';
import fileConfig from '../../assets/svgs/file-config.svg';
import fileDatabase from '../../assets/svgs/file-database.svg';
import fileExcel from '../../assets/svgs/file-excel.svg';
import fileExe from '../../assets/svgs/file-exe.svg';
import fileFolder from '../../assets/svgs/file-folder.svg';
import fileGif from '../../assets/svgs/file-gif.svg';
import fileImage from '../../assets/svgs/file-image.svg';
import fileJpg from '../../assets/svgs/file-jpg.svg';
import fileLink from '../../assets/svgs/file-link.svg';
import fileMail from '../../assets/svgs/file-mail.svg';
import fileMarkdown from '../../assets/svgs/file-markdown.svg';
import filePdf from '../../assets/svgs/file-pdf.svg';
import filePpt from '../../assets/svgs/file-ppt.svg';
import fileSql from '../../assets/svgs/file-sql.svg';
import fileText from '../../assets/svgs/file-text.svg';
import fileUnknown from '../../assets/svgs/file-unknown.svg';
import fileVideo from '../../assets/svgs/file-video.svg';
import fileWord from '../../assets/svgs/file-word.svg';
import fileWps from '../../assets/svgs/file-wps.svg';

/** 文件类型 —— 每个类型对应一个图标文件。 */
export type DocumentIconKind =
  | '3d'
  | 'archive'
  | 'audio'
  | 'code'
  | 'config'
  | 'database'
  | 'excel'
  | 'exe'
  | 'folder'
  | 'gif'
  | 'image'
  | 'jpg'
  | 'link'
  | 'mail'
  | 'markdown'
  | 'pdf'
  | 'ppt'
  | 'sql'
  | 'text'
  | 'unknown'
  | 'video'
  | 'word'
  | 'wps';

/** 类型 → 图标 URL。 */
const ICONS: Record<DocumentIconKind, string> = {
  '3d': file3d,
  archive: fileArchive,
  audio: fileAudio,
  code: fileCode,
  config: fileConfig,
  database: fileDatabase,
  excel: fileExcel,
  exe: fileExe,
  folder: fileFolder,
  gif: fileGif,
  image: fileImage,
  jpg: fileJpg,
  link: fileLink,
  mail: fileMail,
  markdown: fileMarkdown,
  pdf: filePdf,
  ppt: filePpt,
  sql: fileSql,
  text: fileText,
  unknown: fileUnknown,
  video: fileVideo,
  word: fileWord,
  wps: fileWps,
};

/** 类型 → 该类型认的扩展名。 */
const KIND_EXTENSIONS: Record<DocumentIconKind, string[]> = {
  '3d': ['3d', '3ds', 'blend', 'fbx', 'glb', 'gltf', 'obj', 'stl'],
  archive: ['7z', 'archive', 'bz2', 'gz', 'gzip', 'rar', 'tar', 'tgz', 'xz', 'zip'],
  audio: ['aac', 'audio', 'flac', 'm4a', 'mp3', 'ogg', 'opus', 'wav', 'wma'],
  code: [
    'c',
    'code',
    'cpp',
    'cs',
    'css',
    'go',
    'h',
    'htm',
    'html',
    'java',
    'js',
    'jsx',
    'less',
    'php',
    'ps1',
    'py',
    'rb',
    'rs',
    'scss',
    'sh',
    'svelte',
    'swift',
    'ts',
    'tsx',
    'vue',
  ],
  config: ['conf', 'config', 'env', 'ini', 'json', 'toml', 'xml', 'yaml', 'yml'],
  database: ['accdb', 'database', 'db', 'mdb', 'sqlite', 'sqlite3'],
  excel: ['csv', 'excel', 'xls', 'xlsb', 'xlsm', 'xlsx'],
  exe: ['app', 'dmg', 'exe', 'msi'],
  folder: ['folder'],
  gif: ['gif'],
  image: ['avif', 'bmp', 'heic', 'image', 'png', 'svg', 'tif', 'tiff', 'webp'],
  jpg: ['jpe', 'jpeg', 'jpg'],
  link: ['link', 'lnk', 'url', 'webloc'],
  mail: ['eml', 'mail', 'msg'],
  markdown: ['markdown', 'md', 'mdown'],
  pdf: ['pdf'],
  ppt: ['pps', 'ppsx', 'ppt', 'pptm', 'pptx'],
  sql: ['database-table', 'sql'],
  text: ['log', 'text', 'txt'],
  unknown: ['unknown'],
  video: ['avi', 'm4v', 'mkv', 'mov', 'mp4', 'mpeg', 'video', 'webm', 'wmv'],
  word: ['doc', 'docm', 'docx', 'dot', 'dotx', 'word'],
  wps: ['dps', 'dpt', 'et', 'ett', 'wps', 'wpt'],
};

/** 扩展名 → 类型（由上面的表摊平）。 */
const EXTENSION_KIND: Record<string, DocumentIconKind> = Object.fromEntries(
  Object.entries(KIND_EXTENSIONS).flatMap(([kind, extensions]) =>
    extensions.map((extension) => [extension, kind as DocumentIconKind])
  )
);

/**
 * 判断一个文档该用哪个图标。
 *
 * 优先看接口给的 `flgType`（`md` / `docx` / …），认不出来再退回文件名的扩展名 ——
 * 接口的 `flgType` 偶尔是数字码（`fileType: "10"`），那种只能靠文件名。
 */
export const resolveDocumentIconKind = (fileName: string, fileType?: string): DocumentIconKind => {
  const rawType = (fileType ?? '').trim().toLowerCase().replace(/^\./, '');
  if (rawType && EXTENSION_KIND[rawType]) return EXTENSION_KIND[rawType];

  const extension = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';
  if (extension && EXTENSION_KIND[extension]) return EXTENSION_KIND[extension];

  return 'unknown';
};

/** 文件夹图标 —— 知识库封面的兜底（没有自定义图标时用）。 */
export const FILE_FOLDER_ICON = fileFolder;

export type DocumentFileIconProps = {
  /** 文件名 —— 用来取扩展名。 */
  name: string;
  /** 文件类型（接口的 `flgType`，大小写不敏感）。 */
  type?: string;
  /** 图标边长（px）。 */
  size?: number;
  className?: string;
};

/** 文档行左侧的文件类型图标。 */
const DocumentFileIcon: React.FC<DocumentFileIconProps> = ({ name, type, size = 28, className }) => {
  const kind = resolveDocumentIconKind(name, type);
  return (
    <img
      src={ICONS[kind]}
      alt=''
      width={size}
      height={size}
      className={className}
      data-testid={`doc-icon-${kind}`}
      data-doc-icon-kind={kind}
    />
  );
};

export default DocumentFileIcon;
