/*
 * @Author: your name
 * @Date: 2021-11-11 16:00:55
 * @LastEditTime: 2021-12-11 17:47:21
 * @LastEditors: Please set LastEditors
 * @Description: 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 * @FilePath: \edda\hello-vue\src\service\getXmlObj.js
 */
import $axios from './index'
import x2js from 'x2js'

//x2js_instance.xml2js: 将str转为对象      x2js_instance.js2xml(jsonObj)：将对象转为 str
const x2js_instance = new x2js() //创建x2js对象

//传入要获取的接口，返回xml对象
export function getXmlObj(path) {
  return $axios.get(`/xml/${path}.xml`).then((res) => {
    return xmlStrToObj(res.data)
  })
}

export function XmlObjToStr(obj) {
  return x2js_instance.js2xml(obj)
}

export function xmlStrToObj(str) {
  return x2js_instance.xml2js(str)
}

export function createRnd() {
  return new Date().getTime() + (Math.random() * 100000 + '').substr(0, 5)
}
