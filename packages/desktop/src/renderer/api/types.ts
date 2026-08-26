export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  meta?: { total: number; page: number; limit: number };
};

/**
 * 项目 ↔ 智能体 ↔ 文件夹 绑定记录,作用域为当前用户。
 * 存储于 aioncore 后端 `/api/project-binding/{projectId}`。
 */
export type ProjectBinding = {
  projectId: string;
  assistantId: string;
  folderPath: string;
  updatedAt: string; // ISO-8601
};
