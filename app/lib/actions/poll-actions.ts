"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { validateAndSanitizePollData } from "../validation/poll-validation";
import { checkRateLimit, getRateLimitKey } from "../utils/rate-limit";
import { headers } from "next/headers";

// CREATE POLL
export async function createPoll(formData: FormData) {
  const supabase = await createClient();

  const question = formData.get("question") as string;
  const options = formData.getAll("options").filter(Boolean) as string[];

  // Validate and sanitize input
  const validation = validateAndSanitizePollData({ question, options });
  if (validation.error) {
    return { error: validation.error };
  }

  // Get user from session
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) {
    return { error: userError.message };
  }
  if (!user) {
    return { error: "You must be logged in to create a poll." };
  }

  const { error } = await supabase.from("polls").insert([
    {
      user_id: user.id,
      question: validation.question,
      options: validation.options,
    },
  ]);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/polls");
  return { error: null };
}

// GET USER POLLS
export async function getUserPolls() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { polls: [], error: "Not authenticated" };

  const { data, error } = await supabase
    .from("polls")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return { polls: [], error: error.message };
  return { polls: data ?? [], error: null };
}

// GET POLL BY ID (with ownership check for private polls)
export async function getPollById(id: string, requireOwnership: boolean = false) {
  const supabase = await createClient();
  
  if (requireOwnership) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { poll: null, error: "Authentication required" };
    
    const { data, error } = await supabase
      .from("polls")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error) return { poll: null, error: error.message };
    return { poll: data, error: null };
  }
  
  // Public access - anyone can view polls
  const { data, error } = await supabase
    .from("polls")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return { poll: null, error: error.message };
  return { poll: data, error: null };
}

// SUBMIT VOTE (with rate limiting and validation)
export async function submitVote(pollId: string, optionIndex: number) {
  const supabase = await createClient();
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for') || 'unknown';
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Rate limiting for voting
  const rateLimitKey = getRateLimitKey(user?.id || null, ip, 'vote');
  const rateLimit = checkRateLimit(rateLimitKey, 5, 60 * 1000); // 5 votes per minute
  
  if (!rateLimit.allowed) {
    return { error: 'Too many vote attempts. Please try again later.' };
  }

  // Validate poll exists
  const { poll } = await getPollById(pollId);
  if (!poll) return { error: 'Poll not found' };

  // Validate option index
  if (optionIndex < 0 || optionIndex >= poll.options.length) {
    return { error: 'Invalid option selected' };
  }

  // Check if user already voted (prevent multiple votes)
  if (user) {
    const { data: existingVote } = await supabase
      .from("votes")
      .select("id")
      .eq("poll_id", pollId)
      .eq("user_id", user.id)
      .single();

    if (existingVote) {
      return { error: 'You have already voted on this poll' };
    }
  }

  const { error } = await supabase.from("votes").insert([
    {
      poll_id: pollId,
      user_id: user?.id ?? null,
      option_index: optionIndex,
    },
  ]);

  if (error) return { error: error.message };
  return { error: null };
}

// DELETE POLL (with ownership verification)
export async function deletePoll(id: string) {
  const supabase = await createClient();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Authentication required" };

  // Verify ownership before deletion
  const { error } = await supabase
    .from("polls")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/polls");
  return { error: null };
}

// UPDATE POLL
export async function updatePoll(pollId: string, formData: FormData) {
  const supabase = await createClient();

  const question = formData.get("question") as string;
  const options = formData.getAll("options").filter(Boolean) as string[];

  // Validate and sanitize input
  const validation = validateAndSanitizePollData({ question, options });
  if (validation.error) {
    return { error: validation.error };
  }

  // Get user from session
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) {
    return { error: userError.message };
  }
  if (!user) {
    return { error: "You must be logged in to update a poll." };
  }

  // Only allow updating polls owned by the user
  const { error } = await supabase
    .from("polls")
    .update({ question: validation.question, options: validation.options })
    .eq("id", pollId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/polls");
  return { error: null };
}
