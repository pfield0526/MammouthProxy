const axios = require('axios')
const FormData = require('form-data')
const crypto = require('crypto')
const accountManager = require('./manager')

class ImageUploader {
  constructor() {
    this.uploadUrl = 'https://mammouth.ai/api/attachments/saveFile'
    this.imageCache = new Map()
  }


  generateHash(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex')
  }

  async uploadImage(imageBuffer, imageName) {
    // 确保参数有效
    if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
      throw new Error('无效的图片数据')
    }

    if (!imageName) {
      imageName = `image_${Date.now()}.png`
    }

    // 生成图片数据的哈希值作为缓存key
    const imageHash = this.generateHash(imageBuffer)
    
    // 检查缓存中是否已存在该图片的上传结果
    if (this.imageCache.has(imageHash)) {
      console.log(`图片缓存命中: ${imageHash.substring(0, 8)}...`)
      return this.imageCache.get(imageHash)
    }
    
    console.log(`图片缓存未命中，开始上传: ${imageHash.substring(0, 8)}...`)

    // 获取一个可用的cookie
    const cookieValue = accountManager.getNextAvailableCookie()
    if (!cookieValue) {
      throw new Error('没有可用的账号')
    }

    // 创建FormData对象
    const form = new FormData()
    form.append('type', 'image')
    form.append('name', imageName)
    form.append('file', imageBuffer, {
      filename: 'blob',
      contentType: 'image/png' // 默认为PNG，可根据实际情况调整
    })

    try {
      // 发送请求
      const response = await axios.post(this.uploadUrl, form, {
        headers: {
          ...form.getHeaders(),
          'Cookie': `auth_session=${cookieValue}`,
          'Origin': 'https://mammouth.ai',
          'Referer': 'https://mammouth.ai/app/a/default'
        }
      })

      // 检查响应
      if (response.data && response.data.location) {
        const imageUrl = response.data.location
        
        // 将结果保存到缓存
        this.imageCache.set(imageHash, imageUrl)
        console.log(`图片上传成功并缓存: ${imageHash.substring(0, 8)}... -> ${imageUrl}`)
        
        return imageUrl
      } else {
        throw new Error('上传成功但返回格式不正确')
      }
    } catch (error) {
      // 如果是账号限制问题，尝试其他账号
      if (error.response && error.response.status === 403) {
        accountManager.markAsUnavailable(cookieValue)
        // 递归尝试使用新账号
        return this.uploadImage(imageBuffer, imageName)
      }
      
      throw new Error(`图片上传失败: ${error.message}`)
    }
  }

  async uploadFromBase64(base64String, imageName) {
    // 处理base64字符串，移除可能的前缀
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')
    
    // 如果提供了前缀，则从中提取图片类型
    let fileExt = 'png'
    const mimeMatch = base64String.match(/^data:image\/(\w+);base64,/)
    if (mimeMatch && mimeMatch[1]) {
      fileExt = mimeMatch[1]
    }
    
    // 如果没有提供文件名，则使用哈希值的前8位和时间戳生成
    if (!imageName) {
      const hash = this.generateHash(buffer).substring(0, 8)
      imageName = `image_${hash}_${Date.now()}.${fileExt}`
    }
    
    return this.uploadImage(buffer, imageName)
  }

  async uploadFromUrl(imageUrl, imageName) {
    try {
      // 下载图片
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer'
      })
      
      // 从URL中提取文件扩展名
      let fileExt = 'png'
      const urlMatch = imageUrl.match(/\.([a-zA-Z0-9]+)(?:\?.*)?$/)
      if (urlMatch && urlMatch[1]) {
        fileExt = urlMatch[1].toLowerCase()
      }
      
      // 生成buffer并计算哈希
      const buffer = Buffer.from(response.data)
      
      // 如果没有提供文件名，则使用哈希值的前8位和时间戳生成
      if (!imageName) {
        const hash = this.generateHash(buffer).substring(0, 8)
        imageName = `image_${hash}_${Date.now()}.${fileExt}`
      }
      
      return this.uploadImage(buffer, imageName)
    } catch (error) {
      throw new Error(`从URL获取图片失败: ${error.message}`)
    }
  }
  
  getCacheStats() {
    return {
      size: this.imageCache.size,
      keys: Array.from(this.imageCache.keys()).map(k => k.substring(0, 8) + '...')
    }
  }
  
  clearCache() {
    const oldSize = this.imageCache.size
    this.imageCache.clear()
    return { cleared: oldSize }
  }
}


module.exports = new ImageUploader() 