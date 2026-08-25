/**
 * 类目 / 账户枚举缓存，避免各页重复请求
 */

const { getCategories, getAccounts } = require('../api/config')
const { BILL_TYPE } = require('./bill-map')

const FALLBACK_COLORS = [
  '#C45C26',
  '#2F6F8F',
  '#8B5E3C',
  '#4A6B5A',
  '#B4532A',
  '#A33B3B',
  '#3D5A80',
  '#1F6B4F',
  '#6B7280'
]

let cache = {
  categories: null,
  accounts: null,
  loading: null
}

function colorForCode(code) {
  const s = String(code || '')
  let hash = 0
  for (let i = 0; i < s.length; i += 1) hash = (hash * 31 + s.charCodeAt(i)) | 0
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length]
}

function normalizeCategory(item) {
  return {
    code: item.code,
    type: Number(item.type),
    name: item.name || item.code,
    icon: item.icon || '📦',
    color: item.color || colorForCode(item.code),
    // 兼容旧字段
    id: item.code
  }
}

function normalizeAccount(item) {
  return {
    accountId: Number(item.accountId),
    accountName: item.accountName || '',
    id: Number(item.accountId),
    name: item.accountName || ''
  }
}

async function loadConfig(force = false) {
  if (!force && cache.categories && cache.accounts) {
    return {
      categories: cache.categories,
      accounts: cache.accounts
    }
  }
  if (cache.loading) return cache.loading

  cache.loading = Promise.all([getCategories(), getAccounts()])
    .then(([categories, accounts]) => {
      cache.categories = (categories || []).map(normalizeCategory)
      cache.accounts = (accounts || []).map(normalizeAccount)
      cache.loading = null
      return {
        categories: cache.categories,
        accounts: cache.accounts
      }
    })
    .catch((err) => {
      cache.loading = null
      throw err
    })

  return cache.loading
}

function getCachedCategories() {
  return cache.categories || []
}

function getCachedAccounts() {
  return cache.accounts || []
}

function categoriesByBillType(billType) {
  const list = getCachedCategories()
  if (billType == null || billType === '') return list
  const type = Number(billType)
  return list.filter((c) => c.type === type)
}

function findCategory(code) {
  return (
    getCachedCategories().find((c) => c.code === code) || {
      code: code || 'unknown',
      id: code || 'unknown',
      name: '未分类',
      icon: '❔',
      color: '#8A9A92',
      type: BILL_TYPE.EXPENSE
    }
  )
}

function findAccount(accountId) {
  return getCachedAccounts().find((a) => Number(a.accountId) === Number(accountId))
}

function clearConfigCache() {
  cache = { categories: null, accounts: null, loading: null }
}

module.exports = {
  loadConfig,
  getCachedCategories,
  getCachedAccounts,
  categoriesByBillType,
  findCategory,
  findAccount,
  clearConfigCache,
  BILL_TYPE
}
