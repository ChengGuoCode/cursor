/**
 * 统一请求封装：后续对接真实后端时只改这里即可。
 * useMock=true 时不会发起网络请求，由各 api 模块自行返回 mock。
 */

const { getToken, clearSession, handleUnauthorized } = require('./auth')

function getAppSafe() {
  try {
    return getApp()
  } catch (e) {
    return null
  }
}

function buildUrl(path) {
  const app = getAppSafe()
  const base = (app && app.globalData && app.globalData.apiBaseUrl) || ''
  if (/^https?:\/\//.test(path)) return path
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}

/**
 * @param {object} options
 * @param {string} options.url
 * @param {'GET'|'POST'|'PUT'|'DELETE'|'PATCH'} [options.method]
 * @param {object} [options.data]
 * @param {object} [options.header]
 * @param {boolean} [options.auth] 是否附带 Bearer token，默认 true
 * @param {boolean} [options.skipAuthRedirect] 401 时不跳转登录（如启动拉资料）
 */
function request(options = {}) {
  const {
    url,
    method = 'GET',
    data = {},
    header = {},
    auth = true,
    skipAuthRedirect = false
  } = options

  return new Promise((resolve, reject) => {
    const headers = {
      'Content-Type': 'application/json',
      ...header
    }

    if (auth) {
      const token = getToken()
      if (token) headers.Authorization = `Bearer ${token}`
    }

    wx.request({
      url: buildUrl(url),
      method,
      data,
      header: headers,
      success(res) {
        const { statusCode, data: body } = res

        if (statusCode === 401) {
          const err = new Error('未登录或登录已过期')
          err.code = 401
          if (!skipAuthRedirect) handleUnauthorized(err.message)
          else {
            const { clearSession } = require('./auth')
            clearSession()
          }
          reject(err)
          return
        }

        if (statusCode >= 200 && statusCode < 300) {
          // 约定后端：{ code, data, message }；也兼容直接返回 data
          if (body && typeof body === 'object' && 'code' in body) {
            if (body.code === 0 || body.code === 200) {
              resolve(body.data)
              return
            }
            // 业务层未登录
            if (body.code === 401 || body.code === 40101) {
              const err = new Error(body.message || '未登录或登录已过期')
              err.code = 401
              if (!skipAuthRedirect) handleUnauthorized(err.message)
              else {
                const { clearSession } = require('./auth')
                clearSession()
              }
              reject(err)
              return
            }
            reject(new Error(body.message || '业务错误'))
            return
          }
          resolve(body)
          return
        }

        reject(new Error(`HTTP ${statusCode}`))
      },
      fail(err) {
        reject(err || new Error('网络异常'))
      }
    })
  })
}

function shouldUseMock() {
  const app = getAppSafe()
  return !app || app.globalData.useMock !== false
}

module.exports = {
  request,
  shouldUseMock,
  getToken
}
