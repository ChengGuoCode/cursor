const { request, shouldUseMock } = require('../utils/request')
const { mockUser } = require('../utils/mock')
const {
  applyLoginSession,
  clearSession,
  getToken
} = require('../utils/auth')

/** 获取当前用户资料 — GET /api/user/profile */
function getProfile() {
  if (shouldUseMock()) {
    // Mock：有 token 才视为已登录；未登录返回空，便于闭环演示
    if (!getToken()) {
      return Promise.reject(Object.assign(new Error('未登录'), { code: 401 }))
    }
    return Promise.resolve({ ...mockUser })
  }
  return request({
    url: '/api/user/profile',
    method: 'GET'
  })
}

/** 更新用户资料 — PUT /api/user/profile */
function updateProfile(payload) {
  if (shouldUseMock()) {
    return Promise.resolve({ ...mockUser, ...payload })
  }
  return request({ url: '/api/user/profile', method: 'PUT', data: payload })
}

/**
 * 微信登录换取 token — POST /api/auth/wx-login
 * 成功后会把 token 写入本地 Storage，并返回 { token, user }
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
    data: { code }
  }).then((raw) => applyLoginSession(raw))
}

/** 退出登录 — POST /api/auth/logout（无论接口成败都清本地会话） */
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
