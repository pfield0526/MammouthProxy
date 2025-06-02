const express = require('express')
const axios = require('axios')
const FormData = require('form-data')
const { v4: uuidv4 } = require('uuid')
const { MODEL_MAPPING, MAMMOUTH_API_URL, AUTH_TOKEN ,UNLIMITED_MODELS} = require('../config')
const accountManager = require('../lib/manager')
const imageUploader = require('../lib/uploader')

const router = express.Router()

// API密钥认证中间件
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: {
        message: '缺少有效的API密钥',
        type: 'authentication_error',
        code: 'invalid_api_key'
      }
    })
  }
  
  const apiKey = authHeader.substring(7)
  
  if (apiKey !== AUTH_TOKEN) {
    return res.status(401).json({
      error: {
        message: 'API密钥无效',
        type: 'authentication_error',
        code: 'invalid_api_key'
      }
    })
  }
  
  next()
}

// 检查模型是否在不受限制的列表中
function isUnlimitedModel(model) {
  return UNLIMITED_MODELS.includes(model)
}

// 将OpenAI格式转换为Mammouth格式
async function convertOpenAIToMammouth(openaiRequest) {
  const form = new FormData()
  
  // 模型选择
  const requestedModel = openaiRequest.model
  const mammouthModel = MODEL_MAPPING[requestedModel] || openaiRequest.model
  form.append('model', mammouthModel)
  
  // 提取system角色的消息作为preprompt
  let systemMessages = []
  let regularMessages = []
  
  openaiRequest.messages.forEach(message => {
    if (message.role === 'system') {
      systemMessages.push(message.content)
    } else {
      regularMessages.push(message)
    }
  })
  
  // 将所有system消息组合为preprompt
  const preprompt = systemMessages.join('\n\n')
  form.append('preprompt', preprompt)
  
  // 处理非system角色的消息
  for (const message of regularMessages) {
    // 处理包含图片的消息
    const imagesData = []
    let content = message.content

    // 如果是对象数组（多模态内容）
    if (Array.isArray(message.content)) {
      const textParts = []
      
      // 遍历内容部分
      for (const part of message.content) {
        if (part.type === 'text') {
          textParts.push(part.text)
        } else if (part.type === 'image_url') {
          try {
            // 获取图片数据
            let imageUrl = part.image_url
            if (typeof imageUrl === 'object' && imageUrl.url) {
              imageUrl = imageUrl.url
            }
            
            // 处理base64图片
            if (imageUrl.startsWith('data:image')) {
              const uploadedImageLocation = await imageUploader.uploadFromBase64(imageUrl)
              imagesData.push(uploadedImageLocation)
            } else {
              // 处理URL图片
              const uploadedImageLocation = await imageUploader.uploadFromUrl(imageUrl)
              imagesData.push(uploadedImageLocation)
            }
          } catch (error) {
            console.error('图片处理错误:', error.message)
          }
        }
      }
      
      // 将所有文本部分合并
      content = textParts.join('\n')
    }
    
    form.append('messages', JSON.stringify({
      content: content,
      imagesData: imagesData,
      documentsData: []
    }))
  }
  
  return form
}

// 处理流数据
async function handleStreamResponse(axiosResponse, res, requestedModel) {
  const requestId = uuidv4()
  const timestamp = Math.floor(Date.now() / 1000)
  const decoder = new TextDecoder()
  
  // 发送初始角色数据
  res.write(`data: ${JSON.stringify({
    id: `chatcmpl-${requestId}`,
    object: "chat.completion.chunk",
    created: timestamp,
    model: requestedModel,
    choices: [{
      index: 0,
      delta: { role: "assistant", content: "" },
      finish_reason: null
    }]
  })}\n\n`)

  axiosResponse.data.on('data', (chunk) => {
    const chunkStr = decoder.decode(chunk, { stream: true })
    
    // 直接将文本内容作为OpenAI流格式发送
    const textToSend = chunkStr
    if (textToSend) {
      res.write(`data: ${JSON.stringify({
        id: `chatcmpl-${requestId}`,
        object: "chat.completion.chunk",
        created: timestamp,
        model: requestedModel,
        choices: [{
          index: 0,
          delta: { content: textToSend },
          finish_reason: null
        }]
      })}\n\n`)
    }
  })
  
  axiosResponse.data.on('end', () => {
    // 发送完成信号
    res.write(`data: ${JSON.stringify({
      id: `chatcmpl-${requestId}`,
      object: "chat.completion.chunk",
      created: timestamp,
      model: requestedModel,
      choices: [{
        index: 0,
        delta: {},
        finish_reason: "stop"
      }]
    })}\n\n`)
    
    res.write('data: [DONE]\n\n')
    res.end()
  })
  
  axiosResponse.data.on('error', (err) => {
    console.error('流数据处理错误:', err)
    res.status(500).end()
  })
}

// 处理非流数据
function handleNonStreamResponse(axiosResponse, res, requestedModel) {
  const requestId = uuidv4()
  const timestamp = Math.floor(Date.now() / 1000)
  
  // 格式化为OpenAI的响应格式
  let content = axiosResponse.data.content;
  
  // 如果内容是字符串且被引号包裹，移除外层引号
  if (typeof content === 'string' && content.startsWith('"') && content.endsWith('"')) {
    content = content.slice(1, -1);
  }
  
  const responseData = {
    id: `chatcmpl-${requestId}`,
    object: "chat.completion",
    created: timestamp,
    model: requestedModel,
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: content || axiosResponse.data
      },
      finish_reason: "stop"
    }],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    }
  }
  
  res.json(responseData)
}

// 使用新的Cookie重新发送请求
async function retryWithNewCookie(req, res, config, currentCookie, requestedModel, isStreamRequest) {
  try {
    // 标记当前Cookie为不可用
    accountManager.markAsUnavailable(currentCookie)
    
    // 获取新的Cookie
    const newCookie = accountManager.getNextAvailableCookie()
    
    // 更新请求配置中的Cookie
    config.headers.Cookie = `auth_session=${newCookie}`
    
    // 发送请求到Mammouth API
    const response = await axios(config)
    
    // 处理响应
    if (isStreamRequest) {
      handleStreamResponse(response, res, requestedModel)
    } else {
      handleNonStreamResponse(response, res, requestedModel)
    }
    
    return true
  } catch (error) {
    // 如果重试也失败了，返回false
    return false
  }
}

// OpenAI兼容的聊天完成API接口，使用中间件验证API密钥
router.post('/completions', authenticate, async (req, res) => {
  try {
    const openaiRequest = req.body
    const isStreamRequest = openaiRequest.stream === true
    const requestedModel = openaiRequest.model
    
    // 设置适当的响应头
    if (isStreamRequest) {
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
    }
    
    // 转换请求格式
    const form = await convertOpenAIToMammouth(openaiRequest)
    
    // 获取Cookie - 根据模型类型使用不同的获取方法
    const cookieValue = isUnlimitedModel(requestedModel) 
      ? accountManager.getAnyCookie()
      : accountManager.getNextAvailableCookie()
    
    // 准备请求配置
    const config = {
      method: 'post',
      url: MAMMOUTH_API_URL,
      headers: {
        ...form.getHeaders(),
        'Cookie': `auth_session=${cookieValue}`,
        'origin': 'https://mammouth.ai'
      },
      data: form,
      responseType: isStreamRequest ? 'stream' : 'json'
    }
    
    try {
      // 发送请求到Mammouth API
      const response = await axios(config)
      
      // 处理响应
      if (isStreamRequest) {
        handleStreamResponse(response, res, requestedModel)
      } else {
        handleNonStreamResponse(response, res, requestedModel)
      }
    } catch (error) {
      // 优化错误日志打印，只打印关键信息
      const errorStatus = error.response?.status || 'unknown'
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error'
      console.error(`API转发错误: [${errorStatus}] ${errorMessage}`)
      
      // 如果是403错误（达到使用限制）
      if (error.response && error.response.status === 403) {
        // console.log(error)
        
        console.log(`账号 ${cookieValue.substring(0, 5)}... 使用模型 ${requestedModel} 已达到使用限制`)
        
        // 根据模型类型进行不同处理
        if (isUnlimitedModel(requestedModel)) {
          // 不受限模型也返回403，尝试将当前账号标记为不可用并再试一次
          accountManager.markAsUnavailable(cookieValue)
          
          // 对于不受限模型再次获取一个任意Cookie尝试
          const newCookie = accountManager.getAnyCookie()
          console.log(`尝试使用不受限模型的另一个账号: ${newCookie.substring(0, 5)}...`)
          
          // 更新配置
          config.headers.Cookie = `auth_session=${newCookie}`
          
          try {
            // 再次尝试请求
            const response = await axios(config)
            
            // 处理响应
            if (isStreamRequest) {
              handleStreamResponse(response, res, requestedModel)
            } else {
              handleNonStreamResponse(response, res, requestedModel)
            }
            
            // 成功，直接返回
            return
          } catch (retryError) {
            console.error(`无限制模型二次尝试也失败: ${retryError.message}`)
            // 继续到错误处理
          }
        } else {
          // 普通模型，尝试切换账号
          console.log(`尝试使用新账号...`)
          const cookieRetrySuccess = await retryWithNewCookie(
            req, res, config, cookieValue, requestedModel, isStreamRequest
          )
          
          // 如果切换账号成功，就返回
          if (cookieRetrySuccess) return
        }
        
        // 所有重试方法都失败，返回错误信息
        const errorMessage = 
          error.response.data?.message || 
          error.response.data?.statusMessage || 
          '使用限制：所有账号已临时达到使用限制。请稍后再试。'
        
        const requestId = uuidv4()
        const timestamp = Math.floor(Date.now() / 1000)
        
        if (isStreamRequest) {
          // 流式响应情况下，以SSE格式返回错误消息
          res.write(`data: ${JSON.stringify({
            id: `chatcmpl-${requestId}`,
            object: "chat.completion.chunk",
            created: timestamp,
            model: requestedModel,
            choices: [{
              index: 0,
              delta: { role: "assistant", content: "" },
              finish_reason: null
            }]
          })}\n\n`)
          
          // 发送错误消息内容
          res.write(`data: ${JSON.stringify({
            id: `chatcmpl-${requestId}`,
            object: "chat.completion.chunk",
            created: timestamp,
            model: requestedModel,
            choices: [{
              index: 0,
              delta: { content: errorMessage },
              finish_reason: null
            }]
          })}\n\n`)
          
          // 发送完成信号
          res.write(`data: ${JSON.stringify({
            id: `chatcmpl-${requestId}`,
            object: "chat.completion.chunk",
            created: timestamp,
            model: requestedModel,
            choices: [{
              index: 0,
              delta: {},
              finish_reason: "stop"
            }]
          })}\n\n`)
          
          res.write('data: [DONE]\n\n')
          res.end()
        } else {
          // 非流式响应情况下，以普通JSON格式返回错误消息
          res.json({
            id: `chatcmpl-${requestId}`,
            object: "chat.completion",
            created: timestamp,
            model: requestedModel,
            choices: [{
              index: 0,
              message: {
                role: "assistant",
                content: errorMessage
              },
              finish_reason: "stop"
            }],
            usage: {
              prompt_tokens: 0,
              completion_tokens: 0,
              total_tokens: 0
            }
          })
        }
      } else {
        // 其他错误
        res.status(500).json({
          error: {
            message: '处理请求时发生错误',
            type: 'server_error',
            details: error.message
          }
        })
      }
    }
  } catch (error) {
    console.error('请求处理错误:', error)
    res.status(500).json({
      error: {
        message: '处理请求时发生错误',
        type: 'server_error',
        details: error.message
      }
    })
  }
})


module.exports = router 