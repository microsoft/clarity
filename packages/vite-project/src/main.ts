import { createApp } from 'vue'
import './style.css'
// import dd from 'lds/dd.js'
// console.log('ddd', dd)
import './common/clarity.get.js'
import './common/clarity.init.js'
// import "./common/clarity.unmin.js"
import "../../clarity-js/src/global.js"
import App from './App.vue'

createApp(App).mount('#app')
