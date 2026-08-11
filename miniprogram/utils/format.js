function pad(n) {
  return n < 10 ? `0${n}` : `${n}`
}

function toDate(input) {
  if (!input) return new Date()
  if (input instanceof Date) return input
  if (typeof input === 'number') return new Date(input)
  return new Date(String(input).replace(/-/g, '/'))
}

/** 金额展示：分转元或直接元，统一两位小数 */
function formatMoney(value, { withSign = false, type } = {}) {
  const num = Number(value || 0)
  const abs = Math.abs(num).toFixed(2)
  if (!withSign) return abs
  if (type === 'income' || num > 0) return `+${abs}`
  if (type === 'expense' || num < 0) return `-${abs}`
  return abs
}

function formatDate(input, pattern = 'YYYY-MM-DD') {
  const d = toDate(input)
  const map = {
    YYYY: d.getFullYear(),
    MM: pad(d.getMonth() + 1),
    DD: pad(d.getDate()),
    HH: pad(d.getHours()),
    mm: pad(d.getMinutes())
  }
  return pattern.replace(/YYYY|MM|DD|HH|mm/g, (k) => map[k])
}

function formatMonthLabel(input) {
  const d = toDate(input)
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
}

function weekdayLabel(input) {
  const labels = ['日', '一', '二', '三', '四', '五', '六']
  return `周${labels[toDate(input).getDay()]}`
}

/** 将账单列表按日期分组 */
function groupBillsByDate(bills = []) {
  const map = {}
  bills.forEach((bill) => {
    const key = formatDate(bill.occurredAt || bill.date)
    if (!map[key]) {
      map[key] = {
        date: key,
        weekday: weekdayLabel(key),
        expense: 0,
        income: 0,
        items: []
      }
    }
    map[key].items.push(bill)
    if (bill.type === 'income') map[key].income += Number(bill.amount || 0)
    else map[key].expense += Number(bill.amount || 0)
  })
  return Object.keys(map)
    .sort((a, b) => (a < b ? 1 : -1))
    .map((k) => map[k])
}

module.exports = {
  formatMoney,
  formatDate,
  formatMonthLabel,
  weekdayLabel,
  groupBillsByDate
}
