/** 本地兜底类目（优先使用 /config/category） */
const EXPENSE_CATEGORIES = [
  { id: 'food', name: '餐饮', icon: '🍜', color: '#C45C26' },
  { id: 'transport', name: '交通', icon: '🚇', color: '#2F6F8F' },
  { id: 'shopping', name: '购物', icon: '🛍️', color: '#8B5E3C' },
  { id: 'housing', name: '居住', icon: '🏠', color: '#4A6B5A' },
  { id: 'entertainment', name: '娱乐', icon: '🎬', color: '#B4532A' },
  { id: 'medical', name: '医疗', icon: '💊', color: '#A33B3B' },
  { id: 'education', name: '学习', icon: '📚', color: '#3D5A80' },
  { id: 'other_expense', name: '其他', icon: '📦', color: '#6B7280' }
]

const INCOME_CATEGORIES = [
  { id: 'salary', name: '工资', icon: '💼', color: '#1F6B4F' },
  { id: 'bonus', name: '奖金', icon: '🎁', color: '#2A7A5A' },
  { id: 'invest', name: '理财', icon: '📈', color: '#0B3D2E' },
  { id: 'parttime', name: '兼职', icon: '🛠️', color: '#3F7D5A' },
  { id: 'other_income', name: '其他', icon: '💰', color: '#5C8A6E' }
]

/** billType：null=全部，1=收入，2=支出 */
const BILL_TYPE_OPTIONS = [
  { id: null, name: '全部' },
  { id: 1, name: '收入' },
  { id: 2, name: '支出' }
]

const ACCOUNT_TYPES = [
  { id: 'cash', name: '现金' },
  { id: 'wechat', name: '微信' },
  { id: 'alipay', name: '支付宝' },
  { id: 'bank', name: '银行卡' },
  { id: 'credit', name: '信用卡' }
]

function getCategoryById(id) {
  return (
    EXPENSE_CATEGORIES.find((c) => c.id === id) ||
    INCOME_CATEGORIES.find((c) => c.id === id) ||
    { id: 'unknown', name: '未分类', icon: '❔', color: '#8A9A92' }
  )
}

function getCategoryByCode(code) {
  return getCategoryById(code)
}

module.exports = {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  BILL_TYPE_OPTIONS,
  ACCOUNT_TYPES,
  getCategoryById,
  getCategoryByCode
}
