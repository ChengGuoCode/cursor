const { request, shouldUseMock } = require('../utils/request')
const { mockUser } = require('../utils/mock')
const {
  applyLoginSession,
  clearSession,
  getToken,
  normalizeUser
} = require('../utils/auth')

/** 获取当前用户资料 — GET /api/user/profile → ResDTO<User> */
function getProfile() {
  if (shouldUseMock()) {
    if (!getToken()) {
      return Promise.reject(Object.assign(new Error('未登录'), { code: 401 }))
    }
    return Promise.resolve({ ...mockUser })
  }
  return request({
    url: '/api/user/profile',
    method: 'GET'
  }).then((data) => normalizeUser(data) || data)
}

/** 更新用户资料 — PUT /api/user/profile */
function updateProfile(payload) {
  if (shouldUseMock()) {
    return Promise.resolve({ ...mockUser, ...payload })
  }
  return request({ url: '/api/user/profile', method: 'PUT', data: payload }).then(
    (data) => normalizeUser(data) || data
  )
}

/**
 * 微信登录 — 后端 ResDTO<String>，data 即为 token 字符串
 * 成功：缓存 token，返回 { token, user: null }（用户信息需再调 getProfile）
 * 失败：request 层抛出 Error(msg)，调用方保持未登录
 */
function wxLogin(code) {
  if (shouldUseMock()) {
    return Promise.resolve(
      applyLoginSession({ token: 'mock-token', user: mockUser })
    )
  }

  return request({
    url: '/api/user/login',
    method: 'GET',
    data: { code },
    auth: false
  }).then((data) => {
    // data 约定为 token 字符串，例如 ResDTO.ok(token)
    return applyLoginSession(data)
  })
}

/** 退出登录 — 无论接口成败都清本地会话 */
function logout() {
  if (shouldUseMock()) {
    clearSession()
    return Promise.resolve(true)
  }

  return request({
    url: '/api/auth/logout',
    method: 'POST'
  })
    .catch(() => true)
    .finally(() => {
      clearSession()
    })
}

module.exports = {
  getProfile,
  updateProfile,
  wxLogin,
  logout
}
