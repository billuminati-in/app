export type Group = {
  id: string
  name: string
  currency: string
  created_by: string | null
  invite_code: string
  created_at: string
}

export type Member = {
  id: string
  group_id: string
  user_id: string | null
  name: string
  role: 'owner' | 'member'
  created_at: string
}

export type Split = { member_id: string; share: number; percent: number | null }

export type Expense = {
  id: string
  group_id: string
  description: string
  amount: number
  paid_by: string
  split_method: 'equal' | 'percent' | 'exact'
  spent_on: string
  created_by: string | null
  created_at: string
  updated_at: string
  splits: Split[]
}

export type Settlement = {
  id: string
  group_id: string
  from_member: string
  to_member: string
  amount: number
  settled_on: string
  note: string | null
  created_by: string | null
  created_at: string
}

export type Activity = {
  id: number
  group_id: string
  actor: string | null
  kind: string
  data: Record<string, unknown>
  created_at: string
}

export type GroupSummary = {
  id: string
  name: string
  currency: string
  member_count: number
  total: number
  my_balance: number
  owing_count: number
  created_at: string
}
