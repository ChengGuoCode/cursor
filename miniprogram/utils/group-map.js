/**
 * 群组字段约定（与后端对齐）
 * roleType: 1=群主，2=管理员，3=成员
 * group/member status: 1=正常，0=解散或退出
 * apply status: PENDING_APPROVAL(0) / APPROVED(1) / REJECTED(2) / CANCELED(3)
 */

const ROLE_TYPE = {
  OWNER: 1,
  ADMIN: 2,
  MEMBER: 3
}

const GROUP_STATUS = {
  DISSOLVED: 0,
  NORMAL: 1
}

const MEMBER_STATUS = {
  EXITED: 0,
  NORMAL: 1
}

/** 与后端枚举一致 */
const APPLY_STATUS = {
  PENDING_APPROVAL: 0,
  APPROVED: 1,
  REJECTED: 2,
  CANCELED: 3,
  /** 别名，兼容旧引用 */
  PENDING: 0
}

const APPLY_STATUS_OPTIONS = [
  { id: null, name: '全部' },
  { id: 0, name: '待审核' },
  { id: 1, name: '通过' },
  { id: 2, name: '拒绝' },
  { id: 3, name: '取消' }
]

function roleTypeLabel(roleType) {
  const n = Number(roleType)
  if (n === ROLE_TYPE.OWNER) return '群主'
  if (n === ROLE_TYPE.ADMIN) return '管理员'
  if (n === ROLE_TYPE.MEMBER) return '成员'
  return '成员'
}

function applyStatusLabel(status) {
  const n = Number(status)
  if (n === APPLY_STATUS.PENDING_APPROVAL) return '待审核'
  if (n === APPLY_STATUS.APPROVED) return '通过'
  if (n === APPLY_STATUS.REJECTED) return '拒绝'
  if (n === APPLY_STATUS.CANCELED) return '取消'
  return '未知'
}

function isOwner(roleType) {
  return Number(roleType) === ROLE_TYPE.OWNER
}

function isAdmin(roleType) {
  return Number(roleType) === ROLE_TYPE.ADMIN
}

/** 群主或管理员可审核申请 */
function canReview(roleType) {
  const n = Number(roleType)
  return n === ROLE_TYPE.OWNER || n === ROLE_TYPE.ADMIN
}

function extractGroupMembers(dto) {
  if (!dto || typeof dto !== 'object') return []
  if (Array.isArray(dto.groupMembers)) return dto.groupMembers
  if (Array.isArray(dto.members)) return dto.members
  if (Array.isArray(dto.groupMemberList)) return dto.groupMemberList
  return []
}

function normalizeGroup(dto) {
  if (!dto || typeof dto !== 'object') return null
  const groupId = dto.groupId != null ? dto.groupId : dto.id
  const groupName = dto.groupName || dto.name || ''
  // 人数 = 后端返回的成员集合大小（含自己）
  const rawMembers = extractGroupMembers(dto)
  const members = rawMembers.map(normalizeMember).filter(Boolean)
  return {
    ...dto,
    groupId,
    groupName,
    id: groupId,
    name: groupName,
    ownerUserId: dto.ownerUserId,
    inviteCode: dto.inviteCode || '',
    status: dto.status != null ? Number(dto.status) : GROUP_STATUS.NORMAL,
    createTime: dto.createTime != null ? dto.createTime : dto.createdAt || null,
    groupMembers: members,
    memberCount: rawMembers.length
  }
}

/** 解析群组 createTime，用于比较新旧 */
function toCreateTimeMs(value) {
  if (value == null || value === '') return 0
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const t = new Date(value).getTime()
  return Number.isFinite(t) ? t : 0
}

/**
 * 筛选 status=1 的生效群；多个时取 createTime 最新的一条
 * @returns {{ activeList: Array, newest: object|null, newestIndex: number }}
 */
function pickActiveGroups(groupList = []) {
  const activeList = (groupList || []).filter(
    (g) => Number(g.status) === GROUP_STATUS.NORMAL
  )
  if (!activeList.length) {
    return { activeList: [], newest: null, newestIndex: -1 }
  }
  let newestIndex = 0
  let newestMs = toCreateTimeMs(activeList[0].createTime)
  for (let i = 1; i < activeList.length; i += 1) {
    const ms = toCreateTimeMs(activeList[i].createTime)
    if (ms >= newestMs) {
      newestMs = ms
      newestIndex = i
    }
  }
  return {
    activeList,
    newest: activeList[newestIndex],
    newestIndex
  }
}

function normalizeMember(m) {
  if (!m || typeof m !== 'object') return null
  const memberName = m.memberName || m.nickname || m.name || ''
  const hasRole = m.roleType != null && m.roleType !== ''
  const roleType = hasRole ? Number(m.roleType) : null
  return {
    ...m,
    groupMemberId: m.groupMemberId,
    groupId: m.groupId,
    userId: m.userId,
    roleType: Number.isFinite(roleType) ? roleType : null,
    memberName,
    sortNo: m.sortNo,
    status: m.status != null ? Number(m.status) : MEMBER_STATUS.NORMAL,
    roleLabel: roleTypeLabel(roleType),
    avatarText: (memberName || '?').slice(0, 1)
  }
}

function normalizeApply(a) {
  if (!a || typeof a !== 'object') return null
  return {
    ...a,
    id: a.id,
    groupId: a.groupId,
    userId: a.userId,
    nickname: a.nickname || '',
    applyMessage: a.applyMessage || a.applyMsg || '',
    status: a.status != null ? Number(a.status) : APPLY_STATUS.PENDING,
    statusLabel: applyStatusLabel(a.status),
    reviewUserId: a.reviewUserId,
    reviewTime: a.reviewTime,
    reviewRemark: a.reviewRemark || '',
    createTime: a.createTime
  }
}

/** 在成员列表中找到当前用户 */
function findMyMember(group, userId) {
  if (!group || userId == null || userId === '') return null
  const members = group.groupMembers || []
  const sameUser = (m) =>
    String(m.userId) === String(userId) ||
    (m.userId == null && m.id != null && String(m.id) === String(userId))
  return (
    members.find(
      (m) => sameUser(m) && Number(m.status) === MEMBER_STATUS.NORMAL
    ) ||
    members.find(sameUser) ||
    null
  )
}

/**
 * 解析当前用户在群内角色。
 * 1) ownerUserId 与当前用户一致 → 群主（优先，避免成员缺 roleType 被误判）
 * 2) 否则用成员表 roleType（1群主/2管理/3成员）
 */
function resolveMyRoleType(group, userId) {
  if (!group || userId == null || userId === '') return null

  const isGroupOwner =
    group.ownerUserId != null && String(group.ownerUserId) === String(userId)
  if (isGroupOwner) return ROLE_TYPE.OWNER

  const mine = findMyMember(group, userId)
  if (!mine) return null

  const role = Number(mine.roleType)
  if (role === ROLE_TYPE.OWNER || role === ROLE_TYPE.ADMIN || role === ROLE_TYPE.MEMBER) {
    return role
  }
  return null
}

module.exports = {
  ROLE_TYPE,
  GROUP_STATUS,
  MEMBER_STATUS,
  APPLY_STATUS,
  APPLY_STATUS_OPTIONS,
  roleTypeLabel,
  applyStatusLabel,
  isOwner,
  isAdmin,
  canReview,
  normalizeGroup,
  normalizeMember,
  normalizeApply,
  findMyMember,
  resolveMyRoleType,
  toCreateTimeMs,
  pickActiveGroups
}
