/** 支出分类 */
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

/** 收入分类 */
const INCOME_CATEGORIES = [
  { id: 'salary', name: '工资', icon: '💼', color: '#1F6B4F' },
  { id: 'bonus', name: '奖金', icon: '🎁', color: '#2A7A5A' },
  { id: 'invest', name: '理财', icon: '📈', color: '#0B3D2E' },
  { id: 'parttime', name: '兼职', icon: '🛠️', color: '#3F7D5A' },
  { id: 'other_income', name: '其他', icon: '💰', color: '#5C8A6E' }
]

const BILL_TYPES = [
  { id: 'income', name: '收入', billType: 1 },
  { id: 'expense', name: '支出', billType: 2 }
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

/** 兼容 categoryCode / categoryId */
function getCategoryByCode(code) {
  return getCategoryById(code)
}

module.exports = {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  BILL_TYPES,
  ACCOUNT_TYPES,
  getCategoryById,
  getCategoryByCode
}
