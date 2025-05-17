require('dotenv').config()

// Mammouth API配置
const MAMMOUTH_API_URL = 'https://mammouth.ai/api/models/llms'

// 模型映射表：OpenAI模型名称 -> Mammouth模型名称
const MODEL_MAPPING = {
  'claude-3-7-sonnet-latest': 'anthropic-claude-3-7-sonnet-latest',
  'grok-3': 'xai-grok-3-beta',
  'gemini-2.5-pro-preview-05-06': 'google-gemini-2.5-pro',
  'gpt-4o-mini': 'openai-gpt-4o-mini'
}

const UNLIMITED_MODELS = [
  'gpt-4o-mini',
]

// 服务器配置
const SERVER_CONFIG = {
  PORT: process.env.PORT || 3000
}

// 账号管理器配置
const COOKIES = process.env.COOKIES || ""
const AUTH_TOKEN = process.env.AUTH_TOKEN || "sk-123456"


module.exports = {
  MODEL_MAPPING,
  UNLIMITED_MODELS,
  SERVER_CONFIG,
  MAMMOUTH_API_URL,
  COOKIES,
  AUTH_TOKEN,
} 