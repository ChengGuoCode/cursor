const { request, shouldUseMock, buildUrl } = require('../utils/request')
const { mockUser } = require('../utils/mock')
const {
  applyLoginSession,
  clearSession,
  getToken,
  normalizeUser
} = require('../utils/auth')

/** Mock 月度预算（仅本地内存） */
let mockMonthlyBudget = 5000

/** 获取当前用户资料 — GET /api/user/profile → ResDTO<User> */
function getProfile() {
  if (shouldUseMock()) {
    if (!getToken()) {
      return Promise.reject(Object.assign(new Error('未登录'), { code: 401 }))
    }
    return Promise.resolve({ ...mockUser, budget: mockMonthlyBudget })
  }
  return request({
    url: '/api/user/profile',
    method: 'GET'
  }).then((data) => normalizeUser(data) || data)
}

/** 更新用户资料 — PUT /api/user/profile（昵称 / 头像 URL 等） */
function updateProfile(payload) {
  if (shouldUseMock()) {
    Object.assign(mockUser, payload || {})
    return Promise.resolve({ ...mockUser, budget: mockMonthlyBudget })
  }
  return request({ url: '/api/user/profile', method: 'PUT', data: payload }).then(
    (data) => normalizeUser(data) || data
  )
}

/**
 * 上传头像 — POST /api/user/avatar（multipart file）
 * 成功返回头像 URL 字符串（兼容 ResDTO.data 为 string 或 { url/avatarUrl }）
 */
function uploadAvatar(filePath) {
  if (shouldUseMock()) {
    return Promise.resolve(filePath || '')
  }

  return new Promise((resolve, reject) => {
    const token = getToken()
    wx.uploadFile({
      url: buildUrl('/api/user/avatar'),
      filePath,
      name: 'file',
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success(res) {
        let body = res.data
        try {
          body = typeof body === 'string' ? JSON.parse(body) : body
        } catch (e) {
          /* 纯字符串 URL */
        }
        if (res.statusCode === 401) {
          reject(Object.assign(new Error('未登录或登录已过期'), { code: 401 }))
          return
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const tip =
            (body && (body.msg || body.message)) || `上传失败（${res.statusCode}）`
          reject(new Error(tip))
          return
        }
        if (body && typeof body === 'object' && 'code' in body) {
          if (body.code === 0 || body.code === 200) {
            const data = body.data
            if (typeof data === 'string') {
              resolve(data)
              return
            }
            if (data && typeof data === 'object') {
              resolve(data.url || data.avatarUrl || data.avatar || '')
              return
            }
            resolve('')
            return
          }
          reject(new Error(body.msg || body.message || '上传失败'))
          return
        }
        if (typeof body === 'string' && body) {
          resolve(body)
          return
        }
        resolve(
          (body && (body.url || body.avatarUrl || body.avatar)) || filePath || ''
        )
      },
      fail(err) {
        reject(new Error((err && err.errMsg) || '头像上传失败'))
      }
    })
  })
}

/**
 * 获取月度预算 — GET /api/user/budget
 * data 可为 number，或 { budget|amount|monthlyBudget }
 */
function getBudget() {
  if (shouldUseMock()) {
    return Promise.resolve({ budget: mockMonthlyBudget })
  }
  return request({ url: '/api/user/budget', method: 'GET' }).then((data) => {
    if (typeof data === 'number') return { budget: data }
    if (data && typeof data === 'object') {
      return {
        budget: Number(
          data.budget != null
            ? data.budget
            : data.amount != null
              ? data.amount
              : data.monthlyBudget != null
                ? data.monthlyBudget
                : 0
        )
      }
    }
    return { budget: 0 }
  })
}

/**
 * 设置月度预算 — PUT /api/user/budget
 * body: { budget: number }
 */
function updateBudget(budget) {
  const amount = Math.max(0, Number(budget) || 0)
  if (shouldUseMock()) {
    mockMonthlyBudget = amount
    try {
      const { mockOverview } = require('../utils/mock')
      mockOverview.budget = amount
    } catch (e) {
      /* ignore */
    }
    return Promise.resolve({ budget: amount })
  }
  return request({
    url: '/api/user/budget',
    method: 'PUT',
    data: { budget: amount }
  }).then((data) => {
    if (typeof data === 'number') return { budget: data }
    if (data && typeof data === 'object') {
      return {
        budget: Number(
          data.budget != null
            ? data.budget
            : data.amount != null
              ? data.amount
              : amount
        )
      }
    }
    return { budget: amount }
  })
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
  uploadAvatar,
  getBudget,
  updateBudget,
  wxLogin,
  logout
}
