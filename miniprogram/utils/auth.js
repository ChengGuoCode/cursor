/**
 * 登录会话：token 落盘、恢复、清理、401 引导。
 */

function getAppSafe() {
  try {
    return getApp()
  } catch (e) {
    return null
  }
}

function getToken() {
  return wx.getStorageSync('token') || ''
}

function setToken(token) {
  if (token) wx.setStorageSync('token', token)
  else wx.removeStorageSync('token')
}

function clearSession() {
  wx.removeStorageSync('token')
  const app = getAppSafe()
  if (app) app.globalData.userInfo = null
}

function isLoggedIn() {
  return !!getToken()
}

/**
 * 兼容多种后端登录返回结构，统一为 { token, user }
 * 支持：
 * - { token, user }
 * - { accessToken, userInfo }
 * - { token, ...用户字段 }
 */
function normalizeLoginResult(raw) {
  if (!raw || typeof raw !== 'object') {
    return { token: '', user: null }
  }

  const token =
    raw.token || raw.accessToken || raw.access_token || raw.jwt || ''

  let user = raw.user || raw.userInfo || raw.profile || null
  if (!user) {
    const { token: _t, accessToken, access_token, jwt, ...rest } = raw
    if (rest.id || rest.userId || rest.nickname || rest.nickName) {
      user = {
        id: rest.id || rest.userId,
        nickname: rest.nickname || rest.nickName || '',
        avatarUrl: rest.avatarUrl || rest.avatar || '',
        phoneMask: rest.phoneMask || rest.phone || '',
        ...rest
      }
    }
  }

  return { token, user }
}

/** 登录成功后写入 token，并同步 globalData.userInfo */
function applyLoginSession(raw) {
  const { token, user } = normalizeLoginResult(raw)
  if (!token) {
    throw new Error('登录成功但未返回 token')
  }
  setToken(token)
  const app = getAppSafe()
  if (app && user) app.globalData.userInfo = user
  return { token, user }
}

let unauthorizedLock = false

/**
 * 用户主动操作前校验登录。
 * 未登录：提示并跳转「我的」，返回 false；已登录返回 true。
 * 浏览类页面不要调用此方法。
 */
function requireLogin(tip) {
  if (isLoggedIn()) return true
  const title = tip || '请先登录'
  if (unauthorizedLock) return false
  unauthorizedLock = true
  wx.showToast({ title, icon: 'none', duration: 1800 })
  setTimeout(() => {
    unauthorizedLock = false
    try {
      const pages = getCurrentPages()
      const cur = pages[pages.length - 1]
      if (!cur || cur.route !== 'pages/profile/profile') {
        wx.switchTab({ url: '/pages/profile/profile' })
      }
    } catch (e) {
      /* ignore */
    }
  }, 400)
  return false
}

/**
 * 鉴权失效：默认只清会话，不跳转（避免浏览列表时被强推登录）。
 * 写操作可传 { redirect: true }，在用户主动操作失败时再引导登录。
 */
function handleUnauthorized(message, options = {}) {
  const { redirect = false } = options
  clearSession()
  if (!redirect) return
  if (unauthorizedLock) return
  unauthorizedLock = true

  const title = message || '登录已过期，请重新登录'
  wx.showToast({ title, icon: 'none', duration: 2000 })

  setTimeout(() => {
    unauthorizedLock = false
    try {
      const pages = getCurrentPages()
      const cur = pages[pages.length - 1]
      if (!cur || cur.route !== 'pages/profile/profile') {
        wx.switchTab({ url: '/pages/profile/profile' })
      }
    } catch (e) {
      // 启动极早期可能尚无页面栈
    }
  }, 500)
}

module.exports = {
  getToken,
  setToken,
  clearSession,
  isLoggedIn,
  requireLogin,
  normalizeLoginResult,
  applyLoginSession,
  handleUnauthorized
}
