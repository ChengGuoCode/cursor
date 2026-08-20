/**
 * 账单字段约定（与后端对齐）
 * billType: 1=收入 2=支出
 * 个人账单：请求不传 groupId
 * 群组账单：请求传某个群组的 groupId
 * userId / 筛选账户：用 accountId；展示可用 accountName
 */

const BILL_TYPE = {
  INCOME: 1,
  EXPENSE: 2
}

function billTypeToUi(billType) {
  return Number(billType) === BILL_TYPE.INCOME ? 'income' : 'expense'
}

function uiTypeToBillType(type) {
  if (type === 'income') return BILL_TYPE.INCOME
  if (type === 'expense') return BILL_TYPE.EXPENSE
  return undefined
}

/** 后端 BillResDTO → 页面展示结构 */
function mapBillRes(dto) {
  if (!dto) return null
  const type = billTypeToUi(dto.billType)
  const categoryCode = dto.categoryCode || ''
  return {
    id: dto.id,
    groupId: dto.groupId == null ? null : dto.groupId,
    userId: dto.userId,
    billType: dto.billType,
    type,
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
 */
function buildBillPageReq(options = {}) {
  const data = {}
  if (options.month) data.month = options.month
  if (options.billType != null) data.billType = options.billType
  if (options.categoryCode) data.categoryCode = options.categoryCode
  if (options.accountId != null && options.accountId !== '') {
    data.accountId = Number(options.accountId)
  }

  // 仅群组模式带具体 groupId；个人模式不传
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
  billTypeToUi,
  uiTypeToBillType,
  mapBillRes,
  buildBillPageReq
}
