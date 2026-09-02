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

/** 每月沿用：0=不沿用，1=沿用 */
const BUDGET_CARRY_OVER = {
  OFF: 0,
  ON: 1
}

/**
 * periodDate → yyyy-MM-dd（对接后端 LocalDate）
 */
function toPeriodDateString(value, periodType) {
  if (value == null || value === '') return ''
  if (typeof value === 'string') {
    const s = value.trim()
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
    if (/^\d{4}-\d{2}$/.test(s)) {
      return periodType === BUDGET_PERIOD_TYPE.YEAR
        ? `${s.slice(0, 4)}-01-01`
        : `${s}-01`
    }
    // ISO 带时间：2026-09-01T00:00:00
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10)
  }
  if (Array.isArray(value) && value.length >= 3) {
    const y = value[0]
    const m = Number(value[1])
    const d = Number(value[2])
    return `${y}-${m < 10 ? `0${m}` : m}-${d < 10 ? `0${d}` : d}`
  }
  if (typeof value === 'object' && value.year != null) {
    const m = Number(value.monthValue || value.month || 1)
    const d = Number(value.dayOfMonth || value.day || 1)
    return `${value.year}-${m < 10 ? `0${m}` : m}-${d < 10 ? `0${d}` : d}`
  }
  return ''
}

function normalizeCarryOver(value, fallback = BUDGET_CARRY_OVER.ON) {
  if (value == null || value === '') return fallback
  return Number(value) === BUDGET_CARRY_OVER.ON
    ? BUDGET_CARRY_OVER.ON
    : BUDGET_CARRY_OVER.OFF
}

/**
 * 设置预算 — POST /api/bill/budget
 * BudgetDTO: scopeType / scopeId / periodType / periodDate(LocalDate) /
 *            categoryCode? / amount / carryOver(0不沿用 1沿用)
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

  let periodDate = toPeriodDateString(options.periodDate, periodType)
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
  const carryOver = normalizeCarryOver(options.carryOver, BUDGET_CARRY_OVER.ON)
  const body = {
    scopeType,
    periodType,
    periodDate,
    amount,
    carryOver
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
    mockOverview.carryOver = carryOver
    return Promise.resolve(true)
  }

  return request({
    url: '/api/bill/budget',
    method: 'POST',
    data: body,
    forceLoginOnUnauthorized: true
  })
}

/** 兼容 list 为数组 / {list} / {records} */
function asBudgetList(data) {
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.list)) return data.list
  if (data && Array.isArray(data.records)) return data.records
  return []
}

function normalizeBudgetItem(item) {
  if (!item || typeof item !== 'object') return null
  const amount = Number(item.amount != null ? item.amount : item.budget)
  const periodType =
    Number(item.periodType) === BUDGET_PERIOD_TYPE.YEAR
      ? BUDGET_PERIOD_TYPE.YEAR
      : BUDGET_PERIOD_TYPE.MONTH
  return {
    id: item.id != null ? item.id : null,
    scopeType:
      item.scopeType != null ? normalizeScopeType(item.scopeType) : null,
    scopeId: item.scopeId != null ? item.scopeId : null,
    periodType,
    periodDate: toPeriodDateString(item.periodDate, periodType),
    categoryCode: item.categoryCode || '',
    amount: Number.isFinite(amount) ? amount : 0,
    carryOver: normalizeCarryOver(item.carryOver, BUDGET_CARRY_OVER.ON)
  }
}

/**
 * 取「总预算」：优先无 categoryCode 的条目；否则仅当列表只有 1 条时用该条。
 */
function pickOverallBudget(list) {
  const arr = (Array.isArray(list) ? list : [])
    .map(normalizeBudgetItem)
    .filter(Boolean)
  const overall = arr.find((b) => !b.categoryCode)
  if (overall) return overall
  if (arr.length === 1) return arr[0]
  return null
}

/**
 * 查询预算列表 — GET /api/bill/listBudget
 * @param {object} params
 * @param {number} params.scopeType 1个人 / 2群组
 * @param {number|string} [params.groupId] 群组模式必填
 * @param {number} params.periodType 1月度 / 2年度
 * @param {string} params.month yyyy-MM
 */
function listBudget(params = {}) {
  const scopeType = normalizeScopeType(params.scopeType)
  const periodType =
    Number(params.periodType) === BUDGET_PERIOD_TYPE.YEAR
      ? BUDGET_PERIOD_TYPE.YEAR
      : BUDGET_PERIOD_TYPE.MONTH
  const query = {
    scopeType,
    periodType,
    month: params.month
  }
  if (isGroupScope(scopeType) && params.groupId != null && params.groupId !== '') {
    query.groupId = params.groupId
  }

  if (shouldUseMock()) {
    return Promise.resolve([
      {
        id: 1,
        scopeType,
        scopeId: query.groupId || null,
        periodType,
        periodDate:
          periodType === BUDGET_PERIOD_TYPE.YEAR
            ? `${String(params.month || '').slice(0, 4)}-01-01`
            : `${String(params.month || mockOverview.month).slice(0, 7)}-01`,
        categoryCode: '',
        amount: Number(mockOverview.budget) || 0,
        carryOver:
          mockOverview.carryOver != null
            ? Number(mockOverview.carryOver)
            : BUDGET_CARRY_OVER.ON
      }
    ])
  }

  return request({
    url: '/api/bill/listBudget',
    method: 'GET',
    data: query
  }).then((data) => asBudgetList(data).map(normalizeBudgetItem).filter(Boolean))
}

module.exports = {
  getOverview,
  getBills,
  getBillDetail,
  createBill,
  updateBill,
  deleteBill,
  setBudget,
  listBudget,
  pickOverallBudget,
  BUDGET_PERIOD_TYPE,
  BUDGET_CARRY_OVER
}
