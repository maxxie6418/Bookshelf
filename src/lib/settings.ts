import type { Env } from '../env';

// AI 配置读取：密钥来自 secret/env，不下发前端（见需求文档 §7）。
export interface AiConfig {
  baseUrl?: string;
  apiKey?: string;
}

export function getAiConfig(env: Env): AiConfig {
  return {
    baseUrl: env.AI_BASE_URL,
    apiKey: env.AI_API_KEY,
  };
}

export function hasAiConfig(env: Env): boolean {
  return Boolean(env.AI_BASE_URL && env.AI_API_KEY);
}