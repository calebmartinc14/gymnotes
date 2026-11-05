import { requireSupabase } from './supabase'

export type FeedbackCategory = 'bug' | 'idea' | 'other'
export type FeedbackStatus = 'new' | 'reviewing' | 'resolved'

export interface FeedbackItem {
  id: string
  user_id: string
  category: FeedbackCategory
  message: string
  status: FeedbackStatus
  created_at: string
}

export async function checkFeedbackAdmin(userId: string): Promise<boolean> {
  const { data, error } = await requireSupabase()
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return Boolean(data)
}

export async function submitFeedback(
  userId: string,
  category: FeedbackCategory,
  message: string,
): Promise<void> {
  const { error } = await requireSupabase()
    .from('feedback')
    .insert({ user_id: userId, category, message: message.trim() })
  if (error) throw error
}

export async function fetchFeedback(): Promise<FeedbackItem[]> {
  const { data, error } = await requireSupabase()
    .from('feedback')
    .select('id, user_id, category, message, status, created_at')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []) as FeedbackItem[]
}

export async function updateFeedbackStatus(
  id: string,
  status: FeedbackStatus,
): Promise<void> {
  const { error } = await requireSupabase().from('feedback').update({ status }).eq('id', id)
  if (error) throw error
}
