const { formatDate } = require('./format')

const today = new Date()
const y = today.getFullYear()
const m = today.getMonth()
const d = today.getDate()

function daysAgo(n) {
  const date = new Date(y, m, d - n, 12, 30, 0)
  return formatDate(date, 'YYYY-MM-DD HH:mm')
}

const mockUser = {
  id: 'u_1001',
  nickname: '阿树',
  avatarUrl: '',
  phoneMask: '138****1024',
  motto: '先记清楚，再花明白'
}

const mockBills = [
  {
    id: 'b1',
    type: 'expense',
    amount: 38.5,
    categoryId: 'food',
    accountId: 'wechat',
    remark: '午饭·盖浇饭',
    groupId: null,
    occurredAt: daysAgo(0),
    createdBy: 'u_1001'
  },
  {
    id: 'b2',
    type: 'expense',
    amount: 6,
    categoryId: 'transport',
    accountId: 'wechat',
    remark: '地铁通勤',
    groupId: null,
    occurredAt: daysAgo(0),
    createdBy: 'u_1001'
  },
  {
    id: 'b3',
    type: 'income',
    amount: 12000,
    categoryId: 'salary',
    accountId: 'bank',
    remark: '本月工资',
    groupId: null,
    occurredAt: daysAgo(1),
    createdBy: 'u_1001'
  },
  {
    id: 'b4',
    type: 'expense',
    amount: 128,
    categoryId: 'shopping',
    accountId: 'alipay',
    remark: '日用品',
    groupId: 'g1',
    occurredAt: daysAgo(2),
    createdBy: 'u_1001'
  },
  {
    id: 'b5',
    type: 'expense',
    amount: 86,
    categoryId: 'entertainment',
    accountId: 'wechat',
    remark: '电影票',
    groupId: 'g1',
    occurredAt: daysAgo(3),
    createdBy: 'u_1002'
  },
  {
    id: 'b6',
    type: 'expense',
    amount: 2200,
    categoryId: 'housing',
    accountId: 'bank',
    remark: '房租',
    groupId: null,
    occurredAt: daysAgo(5),
    createdBy: 'u_1001'
  },
  {
    id: 'b7',
    type: 'expense',
    amount: 45,
    categoryId: 'food',
    accountId: 'wechat',
    remark: '咖啡',
    groupId: null,
    occurredAt: daysAgo(6),
    createdBy: 'u_1001'
  }
]

const mockGroups = [
  {
    id: 'g1',
    name: '合租小家',
    coverColor: '#1F6B4F',
    memberCount: 3,
    monthExpense: 214.0,
    myBalance: -42.5,
    role: 'owner',
    updatedAt: daysAgo(1)
  },
  {
    id: 'g2',
    name: '周末出游',
    coverColor: '#2F6F8F',
    memberCount: 5,
    monthExpense: 860.0,
    myBalance: 120.0,
    role: 'member',
    updatedAt: daysAgo(4)
  }
]

/**
 * 近七日 = 含今天往前连续 7 个自然日（滚动窗口，不是「本周一到今天」）。
 * 例如今天周三：仍展示 7 列（上周四 → 本周三），无支出的日期金额为 0，柱高为 0。
 */
function buildLast7DaysTrend(bills = []) {
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  const expenseByDate = {}
  bills.forEach((bill) => {
    if (bill.type !== 'expense') return
    const key = formatDate(bill.occurredAt || bill.date, 'YYYY-MM-DD')
    expenseByDate[key] = (expenseByDate[key] || 0) + Number(bill.amount || 0)
  })

  const trend = []
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date(y, m, d - i)
    const dateKey = formatDate(date, 'YYYY-MM-DD')
    const isToday = i === 0
    trend.push({
      date: dateKey,
      // 主标签用日期，避免被理解成「本周星期」
      label: isToday ? '今天' : `${date.getMonth() + 1}/${date.getDate()}`,
      weekday: `周${weekdays[date.getDay()]}`,
      expense: Number((expenseByDate[dateKey] || 0).toFixed(2)),
      isToday
    })
  }
  return trend
}

const mockOverview = {
  month: formatDate(today, 'YYYY-MM'),
  expense: 2503.5,
  income: 12000,
  budget: 5000,
  budgetUsedRatio: 0.5,
  recentBills: mockBills.slice(0, 5),
  categoryStats: [
    { categoryId: 'housing', amount: 2200, ratio: 0.88 },
    { categoryId: 'shopping', amount: 128, ratio: 0.05 },
    { categoryId: 'entertainment', amount: 86, ratio: 0.03 },
    { categoryId: 'food', amount: 83.5, ratio: 0.03 },
    { categoryId: 'transport', amount: 6, ratio: 0.01 }
  ],
  trend: buildLast7DaysTrend(mockBills)
}

module.exports = {
  mockUser,
  mockBills,
  mockGroups,
  mockOverview
}
