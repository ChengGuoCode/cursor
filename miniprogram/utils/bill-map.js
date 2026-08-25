/**
 * 账单字段约定（与后端对齐）
 * billType: 1=收入，2=支出，全部/未选则为 null
 * 个人账单：请求不传 groupId
 * 群组账单：请求传某个群组的 groupId
 */

const BILL_TYPE = {
  ALL: null,
  INCOME: 1,
  EXPENSE: 2
}

const BILL_TYPE_OPTIONS = [
  { id: null, name: '全部' },
  { id: 1, name: '收入' },
  { id: 2, name: '支出' }
]

function billTypeLabel(billType) {
  if (billType === BILL_TYPE.INCOME || billType === 1) return '收入'
  if (billType === BILL_TYPE.EXPENSE || billType === 2) return '支出'
  return '全部'
}

function isIncome(billType) {
  return Number(billType) === BILL_TYPE.INCOME
}

function isExpense(billType) {
  return Number(billType) === BILL_TYPE.EXPENSE
}

/** 归一化：全部 → null；合法 1/2 保留；其余 null */
function normalizeBillType(billType) {
  if (billType === null || billType === undefined || billType === '' || billType === 'all') {
    return null
  }
  const n = Number(billType)
  if (n === BILL_TYPE.INCOME || n === BILL_TYPE.EXPENSE) return n
  return null
}

/** 后端 BillResDTO → 页面展示结构（billType 保持 1/2） */
function mapBillRes(dto) {
  if (!dto) return null
  const billType = normalizeBillType(dto.billType)
  const categoryCode = dto.categoryCode || ''
  return {
    id: dto.id,
    groupId: dto.groupId == null ? null : dto.groupId,
    userId: dto.userId,
    billType,
    categoryCode,
    categoryId: categoryCode,
    accountId: dto.accountId != null ? Number(dto.accountId) : null,
    accountName: dto.accountName || '',
    amount: Number(dto.amount || 0),
    remark: dto.remark || '',
    billDate: dto.billDate || '',
    occurredAt: dto.billDate || dto.createTime || '',
    createTime: dto.createTime
  }
}

/**
 * 组装 PageReqDTO<BillReqDTO>
 * billType 为 null（全部）时不写入 data，由调用方也可显式传 null
 */
function buildBillPageReq(options = {}) {
  const data = {}
  if (options.month) data.month = options.month

  const billType = normalizeBillType(options.billType)
  // 全部：提交 null；收入/支出：1/2
  data.billType = billType

  if (options.categoryCode) data.categoryCode = options.categoryCode
  if (options.accountId != null && options.accountId !== '') {
    data.accountId = Number(options.accountId)
  }

  if (options.scope === 'group' && options.groupId != null && options.groupId !== '') {
    data.groupId = Number(options.groupId)
  }

  return {
    pageNum: options.pageNum || 1,
    pageSize: options.pageSize || 50,
    data
  }
}

module.exports = {
  BILL_TYPE,
  BILL_TYPE_OPTIONS,
  billTypeLabel,
  isIncome,
  isExpense,
  normalizeBillType,
  mapBillRes,
  buildBillPageReq
}
