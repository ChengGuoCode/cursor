const { request, shouldUseMock } = require('../utils/request')
const { mockBills, mockOverview } = require('../utils/mock')
const {
  buildBillPageReq,
  mapBillRes,
  normalizeBillType,
  normalizeScopeType,
  isGroupScope,
  BILL_TYPE
} = require('../utils/bill-map')

const ACCOUNT_CODE_TO_ID = {
  cash: 1,
  wechat: 2,
  alipay: 3,
  bank: 4,
  credit: 5
}

function mockBillToRes(b) {
  const billType =
    b.billType != null
      ? normalizeBillType(b.billType)
      : b.type === 'income'
        ? BILL_TYPE.INCOME
        : BILL_TYPE.EXPENSE
  return mapBillRes({
    id: b.id,
    groupId: b.groupId,
    userId: b.createdBy,
    billType,
    categoryCode: b.categoryCode || b.categoryId,
    accountId:
      b.accountId != null && typeof b.accountId === 'number'
        ? b.accountId
        : ACCOUNT_CODE_TO_ID[b.accountId] || 2,
    accountName: b.accountName || '',
    amount: b.amount,
    remark: b.remark,
    billDate: (b.billDate || b.occurredAt || '').toString().slice(0, 10),
    createTime: b.createTime || b.occurredAt
  })
}

/**
 * 概览仪表盘 — GET /api/bill/overview
 * @param {object} params
 * @param {number} params.scopeType 1个人 / 2群组（必填）
 * @param {number|string} [params.groupId] 群组模式下传下拉选中的群
 * @param {number} params.periodType
 * @param {string} params.month yyyy-MM
 */
function getOverview(params = {}) {
  const scopeType = normalizeScopeType(params.scopeType)
  const query = {
    month: params.month,
    scopeType,
    periodType: params.periodType
  }
  // 群组模式：必须带上选中群的 groupId
  if (isGroupScope(scopeType) && params.groupId != null && params.groupId !== '') {
    query.groupId = params.groupId
  }

  if (shouldUseMock()) {
    const overview = { ...mockOverview, month: params.month || mockOverview.month }
    return Promise.resolve(overview)
  }
  return request({ url: '/api/bill/overview', method: 'GET', data: query })
}

/**
 * 账单分页 — POST /api/bill/page
 * billType: 1收入 / 2支出 / null全部
 * scopeType: 1个人 / 2群组
 */
function getBills(params = {}) {
  const billType = normalizeBillType(
    params.billType !== undefined ? params.billType : null
  )

  const pageReq = buildBillPageReq({
    pageNum: params.pageNum || params.page || 1,
    pageSize: params.pageSize || 50,
    month: params.month,
    billType,
    categoryCode: params.categoryCode,
    accountId: params.accountId,
    scopeType: normalizeScopeType(params.scopeType),
    groupId: params.groupId
  })

  if (shouldUseMock()) {
    let list = mockBills.map(mockBillToRes)

    if (pageReq.data.billType != null) {
      list = list.filter((b) => b.billType === pageReq.data.billType)
    }
    if (pageReq.data.categoryCode) {
      list = list.filter((b) => b.categoryCode === pageReq.data.categoryCode)
    }
    if (pageReq.data.accountId != null) {
      list = list.filter((b) => Number(b.accountId) === Number(pageReq.data.accountId))
    }
    if (pageReq.data.groupId != null) {
      list = list.filter((b) => String(b.groupId) === String(pageReq.data.groupId))
    } else {
      list = list.filter((b) => b.groupId == null || b.groupId === '')
    }

    const pageNum = pageReq.pageNum
    const pageSize = pageReq.pageSize
    const total = list.length
    const start = (pageNum - 1) * pageSize
    const records = list.slice(start, start + pageSize)

    return Promise.resolve({
      total,
      totalPage: Math.ceil(total / pageSize) || 1,
      pageNum,
      pageSize,
      records,
      list: records
    })
  }

  return request({
    url: '/api/bill/page',
    method: 'POST',
    data: pageReq
  }).then((page) => {
    const records = (page.records || []).map(mapBillRes)
    return {
      ...page,
      records,
      list: records
    }
  })
}

function getBillDetail(id) {
  if (shouldUseMock()) {
    const bill = mockBills.find((b) => String(b.id) === String(id))
    if (!bill) return Promise.reject(new Error('账单不存在'))
    return Promise.resolve(mockBillToRes(bill))
  }
  return request({ url: `/api/bills/${id}`, method: 'GET' }).then(mapBillRes)
}

/**
 * 创建账单 — POST /api/bills
 * body 对齐 TransactionReqDTO：groupId?, billType, categoryCode, accountId, amount, remark
 * （无 scopeType）
 */
function createBill(payload = {}) {
  const body = {
    billType: normalizeBillType(payload.billType),
    categoryCode: payload.categoryCode,
    accountId: payload.accountId,
    amount: payload.amount,
    remark: payload.remark != null ? String(payload.remark) : ''
  }
  // 选中群组才传 groupId；个人记账不传
  if (payload.groupId != null && payload.groupId !== '') {
    body.groupId = payload.groupId
  }

  if (shouldUseMock()) {
    const created = {
      id: `b_${Date.now()}`,
      billType: body.billType,
      categoryId: body.categoryCode,
      accountId: body.accountId,
      amount: body.amount,
      remark: body.remark,
      groupId: body.groupId == null ? null : body.groupId,
      occurredAt: new Date().toISOString(),
      createdBy: 'u_1001'
    }
    mockBills.unshift(created)
    return Promise.resolve(mockBillToRes(created))
  }
  return request({
    url: '/api/bills',
    method: 'POST',
    data: body,
    forceLoginOnUnauthorized: true
  })
}

function updateBill(id, payload) {
  if (shouldUseMock()) {
    const idx = mockBills.findIndex((b) => String(b.id) === String(id))
    if (idx < 0) return Promise.reject(new Error('账单不存在'))
    mockBills[idx] = { ...mockBills[idx], ...payload }
    return Promise.resolve(mockBillToRes(mockBills[idx]))
  }
  return request({
    url: `/api/bills/${id}`,
    method: 'PUT',
    data: payload,
    forceLoginOnUnauthorized: true
  })
}

function deleteBill(id) {
  if (shouldUseMock()) {
    const idx = mockBills.findIndex((b) => String(b.id) === String(id))
    if (idx >= 0) mockBills.splice(idx, 1)
    return Promise.resolve(true)
  }
  return request({
    url: `/api/bills/${id}`,
    method: 'DELETE',
    forceLoginOnUnauthorized: true
  })
}

/** 预算周期：1=月度，2=年度 */
const BUDGET_PERIOD_TYPE = {
  MONTH: 1,
  YEAR: 2
}

/**
 * 设置预算 — POST /api/bill/budget
 * BudgetDTO: scopeType / scopeId / periodType / periodDate / categoryCode? / amount
 * - 个人：scopeType=1，不传 scopeId
 * - 群组：scopeType=2，scopeId=groupId
 * - 月度 periodType=1，periodDate=yyyy-MM-01
 */
function setBudget(options = {}) {
  const scopeType = normalizeScopeType(options.scopeType)
  const periodType =
    Number(options.periodType) === BUDGET_PERIOD_TYPE.YEAR
      ? BUDGET_PERIOD_TYPE.YEAR
      : BUDGET_PERIOD_TYPE.MONTH

  let periodDate = options.periodDate
  if (!periodDate) {
    const month = String(options.month || '').trim()
    const yyyyMm = /^\d{4}-\d{2}/.test(month)
      ? month.slice(0, 7)
      : (() => {
          const d = new Date()
          const m = d.getMonth() + 1
          return `${d.getFullYear()}-${m < 10 ? `0${m}` : m}`
        })()
    periodDate =
      periodType === BUDGET_PERIOD_TYPE.YEAR
        ? `${yyyyMm.slice(0, 4)}-01-01`
        : `${yyyyMm}-01`
  }

  const amount = Math.max(0, Number(options.amount) || 0)
  const body = {
    scopeType,
    periodType,
    periodDate,
    amount
  }

  if (isGroupScope(scopeType) && options.scopeId != null && options.scopeId !== '') {
    body.scopeId = options.scopeId
  }
  if (options.categoryCode) {
    body.categoryCode = options.categoryCode
  }
  if (options.id != null && options.id !== '') {
    body.id = options.id
  }

  if (shouldUseMock()) {
    mockOverview.budget = amount
    return Promise.resolve(true)
  }

  return request({
    url: '/api/bill/budget',
    method: 'POST',
    data: body,
    forceLoginOnUnauthorized: true
  })
}

module.exports = {
  getOverview,
  getBills,
  getBillDetail,
  createBill,
  updateBill,
  deleteBill,
  setBudget,
  BUDGET_PERIOD_TYPE
}
