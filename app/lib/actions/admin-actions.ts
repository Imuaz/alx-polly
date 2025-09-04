'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// Admin user IDs - in production, this should be stored in environment variables or database
const ADMIN_USER_IDS = process.env.ADMIN_USER_IDS?.split(',') || [];

export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return false;
  
  // Check if user is in admin list
  return ADMIN_USER_IDS.includes(user.id);
}

export async function getAllPolls() {
  const supabase = await createClient();
  
  // Verify admin access
  if (!(await isAdmin())) {
    return { polls: [], error: 'Unauthorized: Admin access required' };
  }

  const { data, error } = await supabase
    .from('polls')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return { polls: [], error: error.message };
  return { polls: data ?? [], error: null };
}

export async function adminDeletePoll(pollId: string) {
  const supabase = await createClient();
  
  // Verify admin access
  if (!(await isAdmin())) {
    return { error: 'Unauthorized: Admin access required' };
  }

  const { error } = await supabase
    .from('polls')
    .delete()
    .eq('id', pollId);

  if (error) return { error: error.message };
  
  revalidatePath('/admin');
  return { error: null };
}
