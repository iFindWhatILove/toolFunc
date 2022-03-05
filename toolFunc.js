/*
 * @Author: your name
 * @Date: 2022-01-07 16:59:37
 * @LastEditTime: 2022-01-20 14:12:16
 * @LastEditors: Please set LastEditors
 * @Description: 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 * @FilePath: \interface\toolFunc.js
 */
//格式化存款金额
const handle = function (amount) {
  if (amount) {
    amount = amount.replace(/,/g, '')
  } else {
    return '0'
  }

  if (/^\d+\.?\d*$/.test(amount)) {
    if (/^0[1-9]+/.test(amount)) {
      amount = amount.substr(1)
    }
    if (/(^0\.[0-9]*$)/.test(amount)) {
      //检验输入的是 0.12 型小数
      return amount.substr(0, 4)
    } else if (/^[1-9][0-9]*/.test(amount)) {
      //检验输入的是 1234.12 型小数
      if (/\./.test(amount)) {
        //有小数点
        var arr = amount.split('.')
        var integer = arr[0].replace(/\B(?=(\d{3})+$)/g, ',') //给整数部分加千分号
        var decimal = arr[1] //小数部分
        if (!arr[1]) {
          return (amount = integer + '.')
        } else if (arr[1].length > 2) {
          decimal = decimal.substr(0, 2)
        }
        return `${integer}.${decimal}`
      } else {
        //没小数点
        return amount.replace(/\B(?=(\d{3})+$)/g, ',')
      }
    } else {
      return '0'
    }
  } else {
    return '0'
  }
}

export function formatPrice(price, save = 0) {
  // 价格加千分号，第二个参数可以指定保留几位小数点
  price = Number(price).toFixed(save)
  const [integer, digit] = String(price).split('.')
  const integer2 = integer.replace(/\B(?=(\d{3})+$)/g, ',')

  return digit ? integer2 + '.' + digit : integer2
}
