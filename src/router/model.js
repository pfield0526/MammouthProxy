const express = require('express')
const { MODEL_MAPPING } = require('../config')

const router = express.Router()

// 根据映射动态生成可用模型列表
function getAvailableModels() {
  const timestamp = Math.floor(Date.now() / 1000)
  return Object.entries(MODEL_MAPPING).map(([modelId, mammouthId]) => {
    return {
      id: modelId,
      object: 'model',
      created: timestamp,
      owned_by: 'mammouth',
      provider: 'mammouth'
    }
  })
}

// 获取模型列表
router.get('/', (req, res) => {
  res.json({
    object: 'list',
    data: getAvailableModels()
  })
})

module.exports = router 