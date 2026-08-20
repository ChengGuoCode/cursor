/**
 * 账单字段约定（与后端对齐）
 * billType: 1=支出 2=收入
 * 个人账单：请求不传 groupId
 * 群组账单：请求传 groupId
 * userId：由后端从 token 解析，前端不传
 */

const BILL_TYPE = {
  EXPENSE: 1,
  INCOME: 2
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
  const categoryCode = dto.categoryCode || dto.categoryId || ''
  return {
    id: dto.id,
    groupId: dto.groupId == null ? null : dto.groupId,
    userId: dto.userId,
    billType: dto.billType,
    type,
    categoryCode,
    categoryId: categoryCode,
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
 * @param {{
 *   pageNum?: number,
 *   pageSize?: number,
 *   month?: string,
 *   billType?: number,
 *   categoryCode?: string,
 *   accountName?: string,
 *   groupId?: number|string|null,
 *   scope?: 'personal'|'group'
 * }} options
 */
function buildBillPageReq(options = {}) {
  const data = {}
  if (options.month) data.month = options.month
  if (options.billType != null) data.billType = options.billType
  if (options.categoryCode) data.categoryCode = options.categoryCode
  if (options.accountName) data.accountName = options.accountName

  // 仅群组模式带 groupId；个人模式明确不传
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
