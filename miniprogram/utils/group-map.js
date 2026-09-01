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
    groupMembers: members,
    memberCount: rawMembers.length
  }
}

function normalizeMember(m) {
  if (!m || typeof m !== 'object') return null
  const memberName = m.memberName || m.nickname || m.name || ''
  return {
    ...m,
    groupMemberId: m.groupMemberId,
    groupId: m.groupId,
    userId: m.userId,
    roleType: m.roleType != null ? Number(m.roleType) : ROLE_TYPE.MEMBER,
    memberName,
    sortNo: m.sortNo,
    status: m.status != null ? Number(m.status) : MEMBER_STATUS.NORMAL,
    roleLabel: roleTypeLabel(m.roleType),
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
  return (
    members.find(
      (m) =>
        String(m.userId) === String(userId) &&
        Number(m.status) === MEMBER_STATUS.NORMAL
    ) || null
  )
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
  findMyMember
}
