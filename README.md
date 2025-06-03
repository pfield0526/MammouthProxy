# Mammouth API 代理服务

这是一个API代理服务，可以将符合OpenAI格式的API请求转发到Mammouth AI平台，使您能够使用熟悉的OpenAI API格式访问各种AI模型，如Claude、Grok、Gemini和GPT-4o-mini等。

## 功能特点

- 🔄 **OpenAI兼容接口**: 接收标准OpenAI格式的API请求
- 🚀 **多模型支持**: 支持Claude、Grok、Gemini和GPT-4o-mini等多种模型
- 📝 **流式响应**: 支持SSE格式的流式响应处理与转发
- 🔑 **API认证**: 内置API密钥验证机制
- 🔄 **账号轮换**: 自动在多个账号间轮换，解决使用限制问题
- 🛡️ **错误处理**: 优化的错误处理机制，提供友好错误消息

## 安装方法

### 方法一：本地安装

1. 克隆仓库

```bash
git clone https://github.com/rfym21/mammouth-proxy.git
cd mammouth-proxy
```

2. 安装依赖

```bash
npm install
```

3. 配置环境变量
创建`.env`文件:

```
PORT=3000
COOKIES=your_mammouth_cookies_here
AUTH_TOKEN=your_auth_token_here
```

4. 启动服务

```bash
npm start
```

### 方法二：Docker Compose安装

1. 创建docker-compose.yml

```yaml
services:
  mammouth-proxy:
    image: rfym21/mammouth-proxy:latest
    container_name: mammouth-proxy
    restart: always
    ports:
      - "3000:3000"
    environment:
      - COOKIES=your_cookies_here  # 填入Mammouth账号的Cookie，多个账号用逗号分隔
      - AUTH_TOKEN=your_auth_token_here  # 设置API认证密钥
```

2. 启动容器

```bash
docker-compose up -d
```

### 方法三：Docker 命令

``` docker cli
docker run -d -p 3000:3000 -e COOKIES=your_cookies_here -e AUTH_TOKEN=your_auth_token_here --name mammouth-proxy rfym21/mammouth-proxy:latest
```

## 配置说明

### 环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| COOKIES | Mammouth账号Cookie，多个账号用逗号分隔 | cookie1,cookie2,cookie3 |
| AUTH_TOKEN | API认证密钥 | sk-your-auth-token |
| PORT | 服务端口(可选，默认3000) | 3000 |

### Cookie获取方法

1. 登录Mammouth平台(<https://mammouth.ai>)
2. 打开浏览器开发者工具(F12)并切换到"应用"或"存储"选项卡
3. 在Cookies中找到`auth_session`的值
4. 复制该值并设置为环境变量

## 使用示例

### 基本聊天完成请求

``` cURL
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-auth-token" \
  -d '{
    "model": "claude-3-7-sonnet-latest",
    "messages": [
      {
        "role": "user",
        "content": "用中文写一首关于人工智能的短诗。"
      }
    ],
    "stream": false
  }'
```

## 支持的模型

| OpenAI格式模型名称 | Mammouth平台对应模型 |
|-------------------|-------------------|
| claude-3-7-sonnet-latest | anthropic-claude-3-7-sonnet-latest |
| gpt-4o-mini | openai-gpt-4o-mini |
 | o4-mini| openai-o4-mini |
| gemini-2.5-pro-preview-05-06 | google-gemini-2.5-pro |
| grok-3 | xai-grok-3-beta |

**除去Claude和Gemini似乎都不太稳定，谨慎使用**

## 项目结构

```
src/
├── config.js        # 配置文件
├── index.js         # 入口文件
├── lib/
│   └── manager.js   # 账号管理器
└── router/
    ├── chat.js      # 聊天完成API路由
    └── model.js     # 模型API路由
```
