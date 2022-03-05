/*
 * @Author: your name
 * @Date: 2021-12-11 22:02:12
 * @LastEditTime: 2022-01-20 09:19:56
 * @LastEditors: Please set LastEditors
 * @Description: 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 * @FilePath: \edda\hello-vue\src\service\cmsRequest.js
 */
import { getXmlObj, XmlObjToStr, createRnd, xmlStrToObj } from './getXmlObj'
import { getCookie } from './cookies'

const baseConf = {
  cms: 'ws://223.197.14.11:10003'
}

function message(ws, methods, e) {
  //ws是ws对象， methods是暴露到外部供调用的对象，e是响应数据
  let xmlMsg
  let result2 = e.data //响应的 xml字符串

  //猜测：是用来解析 响应xml字符串 的方法
  try {
    if (window.DOMParser) {
      // code for modern browsers
      var parser = new DOMParser()
      xmlMsg = parser.parseFromString(result2, 'text/xml')
    } else {
      // code for old IE browsers
      xmlMsg = window.ActiveXObject && new window.ActiveXObject('Microsoft.XMLDOM')
      xmlMsg.async = false
      xmlMsg.loadXML(result2)
    }
  } catch (err) {
    console.error('加载XML dom出错', e.data)
    return
  }

  //把响应的 xml字符串转为对象，并赋值给 rootObj
  let pkgType = xmlMsg.documentElement.nodeName //获取请求的接口名
  let recData = xmlStrToObj(result2)
  if (!recData) {
    console.error('返回数据为空或XML格式错误:' + e.data)
    return
  }
  const rootObj = recData[pkgType]

  //判断响应的结果如果是 TSCI_110_00002 则表示 session失效，会清除 session，跳转登入页，receiveClose 置为 true;
  if (rootObj.result != 1) {
    //TSCI_110_00002-session失效
    if (rootObj.result == 'TSCI_110_00002') {
      localStorage.clear()
      return
    }
  }

  //这是订阅的 推送消息，订阅一次后，收到响应也不会清除 notices，一直使用同一个回调函数，可以一直监听服务端推送的该接口的数据，除非手动调用 unsubscribeNotice
  //所以通过 pkgType 判断对应的那个订阅，执行回调
  const pushNodes = methods['notices'][pkgType]
  if (pushNodes && pushNodes.length) {
    for (const noticeItem of pushNodes) {
      try {
        noticeItem.callback?.(recData)
      } catch (ex) {
        console.error('推送时callback错误')
      }
    }
  } else {
    //这是处理非订阅的响应，收到响应后，会执行 requests 里对应的回调，并且从 requests 中删除该信息
    //所以通过 _msgnum 判断对应的那个订阅，执行回调
    let pm = fnList[rootObj._msgnum]
    if (pm) {
      let spend = Date.now() - pm.time //请求应答时间ms
      var timeoutx = baseConf.requestTime || 5000
      if (spend > timeoutx) {
        console.error('请求应答时间超过太长' + spend + 'ms')
      }
      pm.callback({ rootObj, pm })

      //清除内存占用
      pm.callback = null
      pm = null
      Reflect.deleteProperty(fnList, rootObj._msgnum)
      return
    } else {
      //在 requests中未找到该请求的信息
      console.error('no found msg num', { recData })
    }
  }
}

let fnList = {
  // rnd: {
  //   request, //请求参数 {'login': { '_msgnum': rnd }}
  //   root, //请求接口
  //   callback, //resolve函数
  //   time: Date.now(), //发起请求的时间，用于做超时判断
  // },
}

const diableResend = ['login'] //禁止重复发送的包
let dataStream //ws对象
const xmlDec = "<?xml version='1.0' encoding='UTF-8'?>"
let receiveClose

const methods = {
  get(queryParam) {
    //receiveClose 为 true表示ws连接已断开，不能发送请求
    if (receiveClose) {
      console.log('收到链接已断开，不能发送请求', queryParam)
      return
    }

    const root = Object.keys(queryParam)[0]
    //根据当前时间生成一个随机数
    let rnd = createRnd()
    //自动给请求参数加上 rnd 和 session 和 user_id 和 password
    queryParam[root]._msgnum = rnd
    queryParam[root].session = localStorage.getItem(baseConf.constFds.cmps_session)
    queryParam[root]['user_id'] = getCookie('username')
    queryParam[root]['password'] = getCookie('password')
    let msg2 = XmlObjToStr(queryParam)

    if (!dataStream) {
      this.connect()
      return new Promise(resolve => {
        fnList[rnd] = {
          request: queryParam,
          root,
          callback: resolve
        }
      })
    } else if (dataStream.readyState == 1) {
      //如果 ws 连接已建立，就直接执行回调，回调里基本是放 datastreanm.send(xmlDec + msg2)
      dataStream.send(xmlDec + msg2)
      return new Promise(resolve => {
        fnList[rnd] = {
          request: queryParam,
          root,
          callback: resolve,
          time: Date.now()
        }
      })
    } else if (dataStream.readyState == 3) {
      // 连接已关闭或根本没建立
      return Promise.reject('dataStream.readyState == 3')
    } else {
      //readyState 为 2，表示连接正在进行关闭握手，即将关闭。
      return Promise.reject('发送消息时连接已被断开', dataStream.readyState)
    }
  },
  async login(loginID, password) {
    let res = await getXmlObj('login')
    let queryParam = res['login']
    queryParam.terminal_type = baseConf.terminal_type
    queryParam.user_id = loginID
    queryParam.password = password
    var Num = '9024880' + Math.floor(Math.random() * 1000000)
    queryParam.extra.device_code = Date.now() + Num //设备编码
    queryParam.extra.device_name = 'Chrome' //设备名称
    queryParam.encoding = 'UTF8'
    queryParam.language = 'CHS'
    let rnd = createRnd()
    queryParam['_msgnum'] = rnd

    let msg = XmlObjToStr(res)

    let send = function () {
      if (!dataStream || dataStream.readyState != 1) {
        //表示ws连接还没建立，则 100毫秒 后发送登入请求
        setTimeout(send, 100)
      } else {
        //ws 连接已建立，可以发送登入请求
        dataStream.send(xmlDec + msg)
      }
    }
    send()
    console.log('cms websocket logon') //表示还未确定是否成功建立 ws 的阶段
    return new Promise(resolve => {
      fnList[rnd] = {
        request: res,
        root: 'login',
        callback: resolve,
        time: Date.now()
      }
    })
  },
  connect(sucessCall, failBack) {
    //failBack在 onerrer中调用， sucessCall在 onopen中调用
    console.error('重连websocket,当前状态：', dataStream)

    if (dataStream) {
      dataStream.close()
    }

    console.log(baseConf.cms)
    dataStream = new WebSocket(baseConf.cms)
    dataStream.addEventListener('close', function (e) {
      console.log('Close: ', e)
      localStorage.clear()
      fnList = {}
    })
    dataStream.addEventListener('open', function () {
      console.log('重建连接成功 state==', dataStream.readyState)

      let timer
      let todo = function () {
        if (timer) {
          clearTimeout(timer)
        }
        if (dataStream.readyState == 1) {
          //重发请求队列
          console.log('重发请求队列', fnList)

          for (let item of Object.values(fnList)) {
            if (!diableResend.includes(item.root)) {
              const msg = XmlObjToStr(item.request)
              item.time = Date.now()
              dataStream.send(xmlDec + msg)
              console.log('重发请求队列', item.request)
            }
          }
        } else {
          //如果ws连接还没建立，则 40ms后再重发请求
          timer = setTimeout(todo, 40)
        }
      }
      todo()

      if (sucessCall) sucessCall() //执行 sucessCall时并不确定 ws是否重连成功，readystate可能是 1,2,3
    })
    dataStream.onerror = function () {
      if (failBack) failBack()
    }
    dataStream.onmessage = function (e) {
      //dataStream是ws对象， methods是暴露到外部供调用的对象，e是响应数据
      message(dataStream, methods, e)
    }
  },
  notices: {
    today_order_notify: [
      res => {
        console.log(res)
      }
    ]
  },
  subscribe(pkgtype, callback) {
    if (pkgtype && callback) {
      if (this.notices[pkgtype]) {
        this.notices[pkgtype].push(callback)
      } else {
        this.notices[pkgtype] = [callback]
      }

      return () => {
        const index = this.notices[pkgtype].findIndex(i => i === callback)
        if (~index) {
          this.notices[pkgtype].splice(index, 1)
        }
      }
    }
  }
}

export default methods
