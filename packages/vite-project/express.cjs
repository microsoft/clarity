const express = require('express')
const { createServer: createViteServer } = require('vite');
let debounce = require('lodash/debounce')
let fs = require('fs')
// let decode = require('./clarity.decode.cjs')
var bodyParser = require('body-parser');
var https = require('https');
var { decode } = require('../clarity-decode/build/clarity.decode.js')

async function createServer() {

  const app = express()
  // app.use(bodyParser.json());
  // app.use(bodyParser.urlencoded({ extended: true }));
  app.post('/collect', (req, res) => {
    let data = ''
    req.on('data', chunk => {
      data += chunk;
    })
    req.on('end', () => {
      console.log('data', data) // '做点事情'
      let dataObj = JSON.parse(data);
      if (dataObj.p) {
        let v = decode(data);
        console.log(1)
      }
      let v = decode(data);
      console.log(1)
      res.writeHead(200, {
        'Content-type': 'application/json',
        "Access-Control-Allow-Origin": "http://localhost:5173",
        "Access-Control-Allow-Credentials": true
      })
      res.end(JSON.stringify(v))
    })
  })

  // 以中间件模式创建 Vite 服务器
  // const vite = await createViteServer({
  //   server: { middlewareMode: 'html' }
  // })
  // 将 vite 的 connect 实例作中间件使用
  // app.use(vite.middlewares)

  var httpsServer = https.createServer({
    key: fs.readFileSync('../../key.pem'),
    cert: fs.readFileSync('../../cert.pem')
  }, app);

  // httpsServer.post('/collect', (req, res) => {
  //   let body = req.body;
  //   res.send('ok')
  // })

  // app.use('*', async (req, res) => {
  //   // 如果 `middlewareMode` 是 `'ssr'`，应在此为 `index.html` 提供服务.
  //   // 如果 `middlewareMode` 是 `'html'`，则此处无需手动服务 `index.html`
  //   // 因为 Vite 自会接管
  // })

  httpsServer.listen('3001', () => console.log('listen in http://localhost:3001'));

  return app
}

let appPromise = createServer();

// let dbFn = debounce(async (e) => {
//   console.log('ddddd', e);
//   let app = await appPromise;
//   app.close()
// }, 100);

// fs.watch(__filename, {}, (w) => {
//   dbFn(w)
// })