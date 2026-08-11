const { request, shouldUseMock } = require('../utils/request')
const { mockUser } = require('../utils/mock')

/** 获取当前用户资料 — GET /api/user/profile */
function getProfile() {
  if (shouldUseMock()) {
    return Promise.resolve({ ...mockUser })
  }
  return request({ url: '/api/user/profile', method: 'GET' })
}

/** 更新用户资料 — PUT /api/user/profile */
function updateProfile(payload) {
  if (shouldUseMock()) {
    return Promise.resolve({ ...mockUser, ...payload })
  }
  return request({ url: '/api/user/profile', method: 'PUT', data: payload })
}

/** 微信登录换取 token — POST /api/auth/wx-login */
function wxLogin(code) {
  if (shouldUseMock()) {
    wx.setStorageSync('token', 'mock-token')
    return Promise.resolve({ token: 'mock-token', user: mockUser })
  }
  return request({
    url: '/api/auth/wx-login',
    method: 'POST',
    data: { code },
    auth: false
  })
}

/** 退出登录 — POST /api/auth/logout */
function logout() {
  if (shouldUseMock()) {
    wx.removeStorageSync('token')
    return Promise.resolve(true)
  }
  return request({ url: '/api/auth/logout', method: 'POST' }).finally(() => {
    wx.removeStorageSync('token')
  })
}

module.exports = {
  getProfile,
  updateProfile,
  wxLogin,
  logout
}
