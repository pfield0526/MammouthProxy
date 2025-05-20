const express = require('express')
const cors = require('cors')
const { SERVER_CONFIG } = require('./config')
const modelRouter = require('./router/model')
const chatRouter = require('./router/chat')

const app = express()
app.use(cors())

// 增加请求体积限制，设置为50MB
app.use(express.json({ limit: '128mb' }))
app.use(express.urlencoded({ extended: true, limit: '128mb' }))
app.use(express.raw({ limit: '128mb' }))

// 注册路由
app.use('/v1/models', modelRouter)
app.use('/v1/chat', chatRouter)

// 启动服务器
app.listen(SERVER_CONFIG.PORT, () => {
  console.log(`服务已启动在 http://loaclhost:${SERVER_CONFIG.PORT}`)
})
