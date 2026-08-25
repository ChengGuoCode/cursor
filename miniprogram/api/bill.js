const { request, shouldUseMock } = require('../utils/request')
const { mockBills, mockOverview } = require('../utils/mock')
const {
  buildBillPageReq,
  mapBillRes,
  uiTypeToBillType,
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
  return mapBillRes({
    id: b.id,
    groupId: b.groupId,
    userId: b.createdBy,
    billType: b.type === 'income' ? BILL_TYPE.INCOME : BILL_TYPE.EXPENSE,
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
 * 个人：不传 groupId；群组：传具体 groupId
 */
function getOverview(params = {}) {
  const query = {
    month: params.month,
    scopeType: params.scopeType,
    periodType: params.periodType
  }
  if (params.scope === 'group' && params.groupId != null && params.groupId !== '') {
    query.groupId = params.groupId
  }

  if (shouldUseMock()) {
    const overview = { ...mockOverview, month: params.month || mockOverview.month }
    return Promise.resolve(overview)
  }
  return request({ url: '/api/bill/overview', method: 'GET', data: query })
}

/**
 * 账单分页 — POST /api/bills/page
 * PageReqDTO<BillReqDTO> → PageResDTO<BillResDTO>
 */
function getBills(params = {}) {
  const billType =
    params.billType != null
      ? params.billType
      : uiTypeToBillType(params.type === 'all' ? undefined : params.type)

  const pageReq = buildBillPageReq({
    pageNum: params.pageNum || params.page || 1,
    pageSize: params.pageSize || 50,
    month: params.month,
    billType,
    categoryCode: params.categoryCode,
    accountId: params.accountId,
    scope: params.scope || 'personal',
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
    url: '/api/bills/page',
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
 * 建议 body：billType, categoryCode, accountId, amount, remark, billDate, groupId?
 */
function createBill(payload) {
  if (shouldUseMock()) {
    const created = {
      id: `b_${Date.now()}`,
      type: payload.billType === BILL_TYPE.INCOME ? 'income' : 'expense',
      categoryId: payload.categoryCode,
      accountId: payload.accountId,
      amount: payload.amount,
      remark: payload.remark,
      groupId: payload.groupId == null ? null : payload.groupId,
      occurredAt: payload.billDate || payload.occurredAt || new Date().toISOString(),
      createdBy: 'u_1001'
    }
    mockBills.unshift(created)
    return Promise.resolve(mockBillToRes(created))
  }
  return request({
    url: '/api/bills',
    method: 'POST',
    data: payload,
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

module.exports = {
  getOverview,
  getBills,
  getBillDetail,
  createBill,
  updateBill,
  deleteBill
}
