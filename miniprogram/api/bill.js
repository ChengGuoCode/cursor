const { request, shouldUseMock } = require('../utils/request')
const { mockBills, mockOverview } = require('../utils/mock')

/**
 * 概览仪表盘 — GET /api/overview
 * @param {{ month?: string }} params  month=YYYY-MM
 * @returns {Promise<{
 *   month: string,
 *   expense: number,
 *   income: number,
 *   budget: number,
 *   recentBills: array,
 *   categoryStats: Array<{ code?: string, categoryId?: string, amount: number }>,
 *   trend: Array<{ date: string, label: string, weekday: string, expense: number, isToday?: boolean }>
 * }>}
 * 预算进度、分类占比由前端根据 expense/budget、amount/expense 自行计算，后端无需返回 ratio。
 * categoryStats 分类标识字段可为 code 或 categoryId。
 * trend：近七日滚动窗口（含今天共 7 天），按日期升序；无支出日 expense=0，仍返回该天。
 */
function getOverview(params = {}) {
  if (shouldUseMock()) {
    return Promise.resolve({ ...mockOverview, ...params })
  }
  return request({ url: '/api/bill/overview', method: 'GET', data: params })
}

/**
 * 账单列表 — GET /api/bills
 * @param {{
 *   month?: string,
 *   type?: 'expense'|'income'|'all',
 *   categoryId?: string,
 *   groupId?: string,
 *   keyword?: string,
 *   page?: number,
 *   pageSize?: number
 * }} params
 */
function getBills(params = {}) {
  if (shouldUseMock()) {
    let list = [...mockBills]
    if (params.type && params.type !== 'all') {
      list = list.filter((b) => b.type === params.type)
    }
    if (params.categoryId) {
      list = list.filter((b) => b.categoryId === params.categoryId)
    }
    if (params.groupId) {
      list = list.filter((b) => b.groupId === params.groupId)
    }
    if (params.keyword) {
      const kw = params.keyword.trim()
      list = list.filter((b) => (b.remark || '').includes(kw))
    }
    return Promise.resolve({
      list,
      total: list.length,
      page: params.page || 1,
      pageSize: params.pageSize || 20
    })
  }
  return request({ url: '/api/bills', method: 'GET', data: params })
}

/** 账单详情 — GET /api/bills/:id */
function getBillDetail(id) {
  if (shouldUseMock()) {
    const bill = mockBills.find((b) => b.id === id)
    return bill
      ? Promise.resolve({ ...bill })
      : Promise.reject(new Error('账单不存在'))
  }
  return request({ url: `/api/bills/${id}`, method: 'GET' })
}

/**
 * 创建账单 — POST /api/bills
 * @param {{
 *   type: 'expense'|'income',
 *   amount: number,
 *   categoryId: string,
 *   accountId?: string,
 *   remark?: string,
 *   groupId?: string|null,
 *   occurredAt?: string
 * }} payload
 */
function createBill(payload) {
  if (shouldUseMock()) {
    const created = {
      id: `b_${Date.now()}`,
      createdBy: 'u_1001',
      occurredAt: payload.occurredAt || new Date().toISOString(),
      ...payload
    }
    mockBills.unshift(created)
    return Promise.resolve(created)
  }
  return request({
    url: '/api/bills',
    method: 'POST',
    data: payload,
    forceLoginOnUnauthorized: true
  })
}

/** 更新账单 — PUT /api/bills/:id */
function updateBill(id, payload) {
  if (shouldUseMock()) {
    const idx = mockBills.findIndex((b) => b.id === id)
    if (idx < 0) return Promise.reject(new Error('账单不存在'))
    mockBills[idx] = { ...mockBills[idx], ...payload }
    return Promise.resolve({ ...mockBills[idx] })
  }
  return request({
    url: `/api/bills/${id}`,
    method: 'PUT',
    data: payload,
    forceLoginOnUnauthorized: true
  })
}

/** 删除账单 — DELETE /api/bills/:id */
function deleteBill(id) {
  if (shouldUseMock()) {
    const idx = mockBills.findIndex((b) => b.id === id)
    if (idx >= 0) mockBills.splice(idx, 1)
    return Promise.resolve(true)
  }
  return request({
    url: `/api/bills/${id}`,
    method: 'DELETE',
    forceLoginOnUnauthorized: true
  })
}

module.exports = {
  getOverview,
  getBills,
  getBillDetail,
  createBill,
  updateBill,
  deleteBill
}
