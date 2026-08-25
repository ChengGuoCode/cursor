function pad(n) {
  return n < 10 ? `0${n}` : `${n}`
}

function toDate(input) {
  if (!input) return new Date()
  if (input instanceof Date) return input
  if (typeof input === 'number') return new Date(input)
  return new Date(String(input).replace(/-/g, '/'))
}

/**
 * 金额展示
 * @param {number|string} value
 * @param {{ withSign?: boolean, billType?: number|null }} options
 * billType: 1=收入(+)，2=支出(-)
 */
function formatMoney(value, { withSign = false, billType } = {}) {
  const num = Number(value || 0)
  const abs = Math.abs(num).toFixed(2)
  if (!withSign) return abs
  if (Number(billType) === 1) return `+${abs}`
  if (Number(billType) === 2) return `-${abs}`
  if (num > 0) return `+${abs}`
  if (num < 0) return `-${abs}`
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

/** 将账单列表按日期分组（billType: 1收入 2支出） */
function groupBillsByDate(bills = []) {
  const map = {}
  bills.forEach((bill) => {
    const key = formatDate(bill.billDate || bill.occurredAt || bill.date)
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
    const amount = Number(bill.amount || 0)
    if (Number(bill.billType) === 1) map[key].income += amount
    else map[key].expense += amount
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
