/**
 * 账单字段约定（与后端对齐）
 * billType: 1=收入，2=支出，全部为 null
 * scopeType: 1=个人，2=群组
 * 个人账单：不传 groupId；群组账单：传具体 groupId
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

/** 与后端枚举一致：PERSONAL(1), GROUP(2) */
const SCOPE_TYPE = {
  PERSONAL: 1,
  GROUP: 2
}

const SCOPE_TYPE_OPTIONS = [
  { id: 1, name: '个人' },
  { id: 2, name: '群组' }
]

function billTypeLabel(billType) {
  if (Number(billType) === BILL_TYPE.INCOME) return '收入'
  if (Number(billType) === BILL_TYPE.EXPENSE) return '支出'
  return '全部'
}

function scopeTypeLabel(scopeType) {
  return Number(scopeType) === SCOPE_TYPE.GROUP ? '群组' : '个人'
}

function isIncome(billType) {
  return Number(billType) === BILL_TYPE.INCOME
}

function isExpense(billType) {
  return Number(billType) === BILL_TYPE.EXPENSE
}

function isGroupScope(scopeType) {
  return Number(scopeType) === SCOPE_TYPE.GROUP
}

function isPersonalScope(scopeType) {
  return Number(scopeType) === SCOPE_TYPE.PERSONAL
}

/** 归一化 billType：全部 → null；合法 1/2 保留 */
function normalizeBillType(billType) {
  if (billType === null || billType === undefined || billType === '' || billType === 'all') {
    return null
  }
  const n = Number(billType)
  if (n === BILL_TYPE.INCOME || n === BILL_TYPE.EXPENSE) return n
  return null
}

/** 归一化 scopeType：只允许 1/2，默认个人 */
function normalizeScopeType(scopeType) {
  const n = Number(scopeType)
  if (n === SCOPE_TYPE.GROUP) return SCOPE_TYPE.GROUP
  return SCOPE_TYPE.PERSONAL
}

/** 后端 BillResDTO → 页面展示结构 */
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
 * billType 全部为 null；scopeType 为 1/2
 */
function buildBillPageReq(options = {}) {
  const data = {}
  if (options.month) data.month = options.month

  data.billType = normalizeBillType(options.billType)

  const scopeType = normalizeScopeType(options.scopeType)
  data.scopeType = scopeType

  if (options.categoryCode) data.categoryCode = options.categoryCode
  if (options.accountId != null && options.accountId !== '') {
    data.accountId = Number(options.accountId)
  }

  if (scopeType === SCOPE_TYPE.GROUP && options.groupId != null && options.groupId !== '') {
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
  SCOPE_TYPE,
  SCOPE_TYPE_OPTIONS,
  billTypeLabel,
  scopeTypeLabel,
  isIncome,
  isExpense,
  isGroupScope,
  isPersonalScope,
  normalizeBillType,
  normalizeScopeType,
  mapBillRes,
  buildBillPageReq
}
