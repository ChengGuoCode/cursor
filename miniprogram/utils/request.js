/**
 * 统一请求封装：后续对接真实后端时只改这里即可。
 * useMock=true 时不会发起网络请求，由各 api 模块自行返回 mock。
 */

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

function getToken() {
  return wx.getStorageSync('token') || ''
}

/**
 * @param {object} options
 * @param {string} options.url
 * @param {'GET'|'POST'|'PUT'|'DELETE'|'PATCH'} [options.method]
 * @param {object} [options.data]
 * @param {object} [options.header]
 * @param {boolean} [options.auth]
 */
function request(options = {}) {
  const {
    url,
    method = 'GET',
    data = {},
    header = {},
    auth = true
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
        if (statusCode >= 200 && statusCode < 300) {
          // 约定后端：{ code, data, message }；也兼容直接返回 data
          if (body && typeof body === 'object' && 'code' in body) {
            if (body.code === 0 || body.code === 200) {
              resolve(body.data)
            } else {
              reject(new Error(body.message || '业务错误'))
            }
          } else {
            resolve(body)
          }
          return
        }
        if (statusCode === 401) {
          wx.removeStorageSync('token')
          reject(new Error('未登录或登录已过期'))
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
