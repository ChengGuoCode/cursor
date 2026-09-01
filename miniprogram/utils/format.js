function pad(n) {
  return n < 10 ? `0${n}` : `${n}`
}

/**
 * 解析为 Date。
 * 避免 iOS 不支持的字符串（如 "2026/09"）：只走组件构造或 iOS 白名单格式。
 * 支持：yyyy-MM、yyyy-MM-dd、yyyy-MM-dd HH:mm[:ss]、ISO(T)、时间戳、Date。
 */
function toDate(input) {
  if (!input && input !== 0) return new Date()
  if (input instanceof Date) return input
  if (typeof input === 'number') {
    const d = new Date(input)
    return Number.isNaN(d.getTime()) ? new Date() : d
  }

  const str = String(input).trim()
  if (!str) return new Date()

  // yyyy-MM / yyyy/MM → 当月 1 日
  let m = str.match(/^(\d{4})[-/](\d{1,2})$/)
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, 1)
  }

  // yyyy-MM-dd / yyyy/MM/dd
  m = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  }

  // yyyy-MM-dd HH:mm[:ss] / yyyy/MM/dd HH:mm[:ss] / 中间用 T
  m = str.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/
  )
  if (m) {
    return new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      Number(m[6] || 0)
    )
  }

  // iOS 支持的 ISO：yyyy-MM-ddTHH:mm:ss[+HH:mm]
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
    const iso = new Date(str)
    if (!Number.isNaN(iso.getTime())) return iso
  }

  const fallback = new Date(str)
  return Number.isNaN(fallback.getTime()) ? new Date() : fallback
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
  toDate,
  formatMoney,
  formatDate,
  formatMonthLabel,
  weekdayLabel,
  groupBillsByDate
}
