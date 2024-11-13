<template>
  <div>
    <div @click="draw">
      click
    </div>
    <table border>
      <tbody>
        <tr><td>11</td><td>11</td><td>11</td></tr>
        <tr><td>11</td><td>11</td><td>11</td></tr>
        <tr><td>11</td><td>11</td><td>11</td></tr>
        <tr><td>11</td><td>11</td><td>11</td></tr>
        <tr><td>11</td><td>11</td><td>11</td></tr>
      </tbody>
    </table>
    <!-- <iframe ref="iframe" src="#" frameborder="0" width="100%" height="700">

    </iframe> -->
  </div>
</template>
<script setup lang="ts">
import {ref}  from 'vue'
import { visualize } from "../../../clarity-visualize/src/index.ts";
let iframe = ref(null);
function draw (){
  // let proxyWindow = window.open(window.location.href)
  // console.log(1111, proxyWindow)
  let length  = window.clarityPayload.length
  visualize.html(window.clarityPayload.slice(0, length), window)
}
</script>
<style lang="">
  
</style>