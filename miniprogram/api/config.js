const { request, shouldUseMock } = require('../utils/request')

/** Mock：type 与 billType 一致，1=收入 2=支出 */
const mockCategories = [
  { code: 'salary', type: 1, name: '工资', icon: '💼' },
  { code: 'bonus', type: 1, name: '奖金', icon: '🎁' },
  { code: 'invest', type: 1, name: '理财', icon: '📈' },
  { code: 'parttime', type: 1, name: '兼职', icon: '🛠️' },
  { code: 'other_income', type: 1, name: '其他收入', icon: '💰' },
  { code: 'food', type: 2, name: '餐饮', icon: '🍜' },
  { code: 'transport', type: 2, name: '交通', icon: '🚇' },
  { code: 'shopping', type: 2, name: '购物', icon: '🛍️' },
  { code: 'housing', type: 2, name: '居住', icon: '🏠' },
  { code: 'entertainment', type: 2, name: '娱乐', icon: '🎬' },
  { code: 'medical', type: 2, name: '医疗', icon: '💊' },
  { code: 'education', type: 2, name: '学习', icon: '📚' },
  { code: 'other_expense', type: 2, name: '其他支出', icon: '📦' }
]

const mockAccounts = [
  { accountId: 1, accountName: '现金' },
  { accountId: 2, accountName: '微信' },
  { accountId: 3, accountName: '支付宝' },
  { accountId: 4, accountName: '银行卡' },
  { accountId: 5, accountName: '信用卡' }
]

/** GET /config/category → ResDTO<List<CategoryDTO>> */
function getCategories() {
  if (shouldUseMock()) {
    return Promise.resolve(mockCategories.map((c) => ({ ...c })))
  }
  return request({ url: '/config/category', method: 'GET' })
}

/** GET /config/account → ResDTO<List<AccountDTO>> */
function getAccounts() {
  if (shouldUseMock()) {
    return Promise.resolve(mockAccounts.map((a) => ({ ...a })))
  }
  return request({ url: '/config/account', method: 'GET' })
}

module.exports = {
  getCategories,
  getAccounts,
  mockCategories,
  mockAccounts
}
