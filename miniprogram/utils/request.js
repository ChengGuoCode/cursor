/**
 * 统一请求封装：对接后端 ResDTO 与 GlobalExceptionHandler。
 *
 * 后端异常约定（GlobalExceptionHandler）：
 * - FfAuthException → HTTP 401，body 为异常文案 → 清会话并跳转登录页
 * - 其它 Exception → HTTP 500，body 为异常文案 → 弹窗提示后自动消失
 *
 * 成功仍为 HTTP 2xx + ResDTO：{ code, msg, data }，code===0 取 data
 */

const { getToken, clearSession, handleUnauthorized } = require('./auth')

/** 服务端错误提示展示时长（ms） */
const SERVER_ERROR_TOAST_MS = 2800

/**
 * 运行环境（内联，避免新建 utils/env.js 在开发者工具
 * ignoreDevUnusedFiles 下未被打包导致 module is not defined）
 */
const runtimeEnv = {
  useMock: false,
  apiBaseUrl: 'http://127.0.0.1:9095'
}

function getEnv() {
  try {
    const app = getApp()
    if (app && app.globalData) {
      if (typeof app.globalData.useMock === 'boolean') {
        runtimeEnv.useMock = app.globalData.useMock
      }
      if (app.globalData.apiBaseUrl) {
        runtimeEnv.apiBaseUrl = String(app.globalData.apiBaseUrl)
      }
    }
  } catch (e) {
    /* App 未就绪时用默认值 */
  }
  return runtimeEnv
}

function setEnv(partial = {}) {
  if (typeof partial.useMock === 'boolean') runtimeEnv.useMock = partial.useMock
  if (partial.apiBaseUrl) runtimeEnv.apiBaseUrl = String(partial.apiBaseUrl)
  return runtimeEnv
}

function buildUrl(path) {
  if (/^https?:\/\//.test(path)) return path
  const { apiBaseUrl } = getEnv()
  const base = (apiBaseUrl || '').replace(/\/$/, '')
  const rel = String(path || '').replace(/^\//, '')
  if (!base) {
    // 无 base 时不要把相对路径交给 wx.request（会报 invalid url）
    return rel ? `/${rel}` : ''
  }
  return `${base}/${rel}`
}

/**
 * 从响应 body 提取文案。
 * GlobalExceptionHandler 直接 body(ex.getMessage())，多为纯字符串。
 */
function extractErrorMessage(body, fallback) {
  if (body == null || body === '') return fallback
  if (typeof body === 'string') {
    const text = body.trim()
    return text || fallback
  }
  if (typeof body === 'object') {
    const tip = body.msg || body.message || body.error || body.data
    if (typeof tip === 'string' && tip.trim()) return tip.trim()
  }
  return fallback
}

/** 500 等服务端异常：toast 提示，合适时间后消失 */
function showServerError(message) {
  const raw = message || '服务器异常'
  // toast 过长会被截断，保留前 40 字
  const title = raw.length > 40 ? `${raw.slice(0, 40)}…` : raw
  wx.showToast({
    title,
    icon: 'none',
    duration: SERVER_ERROR_TOAST_MS,
    mask: true
  })
}

function makeError(message, code, extra = {}) {
  const err = new Error(message || '请求失败')
  err.code = code
  Object.keys(extra).forEach((k) => {
    err[k] = extra[k]
  })
  return err
}

/**
 * @param {object} options
 * @param {string} options.url
 * @param {'GET'|'POST'|'PUT'|'DELETE'|'PATCH'} [options.method]
 * @param {object} [options.data]
 * @param {object} [options.header]
 * @param {boolean} [options.auth] 是否附带 Bearer token，默认 true
 * @param {boolean} [options.silent] 为 true 时不自动弹 500 toast（少数自定义处理场景）
 * @param {boolean} [options.forceLoginOnUnauthorized] 兼容旧参数；401 默认都会跳转登录
 */
function request(options = {}) {
  const {
    url,
    method = 'GET',
    data = {},
    header = {},
    auth = true,
    silent = false,
    forceLoginOnUnauthorized = true
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

    const fullUrl = buildUrl(url)
    // 微信要求绝对地址；相对路径会直接 fail: invalid url
    if (!/^https?:\/\//.test(fullUrl)) {
      const message = '接口地址未配置'
      if (!silent) showServerError(message)
      reject(makeError(message, 'INVALID_URL', { handled: true }))
      return
    }

    wx.request({
      url: fullUrl,
      method,
      data,
      header: headers,
      success(res) {
        const { statusCode, data: body } = res

        // —— GlobalExceptionHandler: 401 ——
        if (statusCode === 401) {
          const message = extractErrorMessage(body, '未登录或登录已过期')
          const err = makeError(message, 401, { handled: true })
          if (forceLoginOnUnauthorized !== false) {
            handleUnauthorized(message, { redirect: true })
          } else {
            clearSession()
          }
          reject(err)
          return
        }

        // —— GlobalExceptionHandler: 500（及其它 5xx）——
        if (statusCode >= 500) {
          const message = extractErrorMessage(body, '服务器异常，请稍后重试')
          if (!silent) showServerError(message)
          reject(makeError(message, statusCode, { handled: true }))
          return
        }

        // —— 其它 4xx ——
        if (statusCode < 200 || statusCode >= 300) {
          const message = extractErrorMessage(body, `请求失败（${statusCode}）`)
          if (!silent) showServerError(message)
          reject(makeError(message, statusCode, { handled: true }))
          return
        }

        // —— HTTP 2xx：ResDTO ——
        if (body && typeof body === 'object' && 'code' in body) {
          const tip = body.msg || body.message || ''
          if (body.code === 0 || body.code === 200) {
            resolve(body.data)
            return
          }
          if (body.code === 401 || body.code === 40101) {
            const message = tip || '未登录或登录已过期'
            const err = makeError(message, 401, { handled: true })
            if (forceLoginOnUnauthorized !== false) {
              handleUnauthorized(message, { redirect: true })
            } else {
              clearSession()
            }
            reject(err)
            return
          }
          // 业务错误：统一轻提示，页面可按 err.handled 避免重复 toast
          if (!silent) showServerError(tip || '业务错误')
          reject(makeError(tip || '业务错误', body.code, { handled: true }))
          return
        }

        resolve(body)
      },
      fail(err) {
        const message =
          (err && (err.errMsg || err.message)) || '网络异常，请检查网络'
        if (!silent) showServerError(message)
        reject(makeError(message, 'NETWORK', { handled: true, raw: err }))
      }
    })
  })
}

function get(url, data, options = {}) {
  return request({ ...options, url, method: 'GET', data })
}

function post(url, data, options = {}) {
  return request({ ...options, url, method: 'POST', data })
}

/**
 * 仅当显式 useMock === true 时走 Mock。
 * 读 runtimeEnv，避免 getApp 未就绪时误判。
 */
function shouldUseMock() {
  return getEnv().useMock === true
}

/** 页面 catch 用：request 已提示过的错误不再重复 toast */
function toastError(err, fallback) {
  if (err && err.handled) return
  wx.showToast({
    title: (err && err.message) || fallback || '操作失败',
    icon: 'none',
    duration: SERVER_ERROR_TOAST_MS
  })
}

module.exports = {
  request,
  get,
  post,
  shouldUseMock,
  getEnv,
  setEnv,
  buildUrl,
  getToken,
  extractErrorMessage,
  showServerError,
  toastError,
  SERVER_ERROR_TOAST_MS
}
