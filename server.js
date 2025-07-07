const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => {
  res.send('Hello from Hardhat Express Web Service!');
});

app.listen(PORT, () => {
  console.log(`Express server running on port ${PORT}`);
});


// 支持 json 请求体解析
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello from Hardhat Express Web Service!');
});

// 新增 POST /v1/chat/completions 路由
app.post('/v1/chat/completions', (req, res) => {
  // 这里是 mock 示例，实际逻辑你可以替换成自己的
  res.json({
    reply: 'Hello, this is a mock reply from /v1/chat/completions',
    your_request: req.body
  });
});

app.listen(PORT, () => {
  console.log(`Express server running on port ${PORT}`);
});
