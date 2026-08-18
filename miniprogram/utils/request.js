/**
 * 统一请求封装：后续对接真实后端时只改这里即可。
 * useMock=true 时不会发起网络请求，由各 api 模块自行返回 mock。
 *
 * 登录引导策略：
 * - 浏览/读接口默认不因 401 跳转登录页
 * - 写操作传 forceLoginOnUnauthorized: true，或页面先调 requireLogin()
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

function onAuthFailure(err, { forceLoginOnUnauthorized }) {
  if (forceLoginOnUnauthorized) {
    handleUnauthorized(err.message, { redirect: true })
  } else {
    clearSession()
  }
}

/**
 * @param {object} options
 * @param {string} options.url
 * @param {'GET'|'POST'|'PUT'|'DELETE'|'PATCH'} [options.method]
 * @param {object} [options.data]
 * @param {object} [options.header]
 * @param {boolean} [options.auth] 是否附带 Bearer token，默认 true
 * @param {boolean} [options.forceLoginOnUnauthorized] 401 时是否跳转登录（写操作用）
 */
function request(options = {}) {
  const {
    url,
    method = 'GET',
    data = {},
    header = {},
    auth = true,
    forceLoginOnUnauthorized = false
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
          onAuthFailure(err, { forceLoginOnUnauthorized })
          reject(err)
          return
        }

        if (statusCode >= 200 && statusCode < 300) {
          if (body && typeof body === 'object' && 'code' in body) {
            if (body.code === 0 || body.code === 200) {
              resolve(body.data)
              return
            }
            if (body.code === 401 || body.code === 40101) {
              const err = new Error(body.message || '未登录或登录已过期')
              err.code = 401
              onAuthFailure(err, { forceLoginOnUnauthorized })
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
