/**
 * 内置工具 — 聚合导出
 */
export { webTools, webSearchTool, webBrowseTool } from './web.js';
export { shellTools, shellExecTool } from './shell.js';
export { filesystemTools, fileReadTool, fileWriteTool, fileListTool } from './filesystem.js';
export { httpTools, httpRequestTool } from './http.js';

import { webTools } from './web.js';
import { shellTools } from './shell.js';
import { filesystemTools } from './filesystem.js';
import { httpTools } from './http.js';

/** 所有内置工具 */
export const allBuiltinTools = [
  ...webTools,
  ...shellTools,
  ...filesystemTools,
  ...httpTools,
];
