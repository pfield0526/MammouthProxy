const express = require('express')
const cors = require('cors')
const { SERVER_CONFIG } = require('./config')
const modelRouter = require('./router/model')
const chatRouter = require('./router/chat')

const app = express()
app.use(cors())
app.use(express.json())

// 注册路由
app.use('/v1/models', modelRouter)
app.use('/v1/chat', chatRouter)

// 启动服务器
app.listen(SERVER_CONFIG.PORT, () => {
  console.log(`服务已启动`)
})
