'use server';

import { createClient } from '@/lib/supabase/server';
import { LoginFormData, RegisterFormData } from '../types';
import { validateRegistrationData, validateLoginData } from '../validation/auth-validation';

export async function login(data: LoginFormData) {
  const supabase = await createClient();

  // Validate input data
  const validation = validateLoginData(data);
  if (validation.error) {
    return { error: validation.error };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: validation.data!.email,
    password: validation.data!.password,
  });

  if (error) {
    return { error: error.message };
  }

  // Success: no error
  return { error: null };
}

export async function register(data: RegisterFormData & { confirmPassword: string }) {
  const supabase = await createClient();

  // Validate input data
  const validation = validateRegistrationData(data);
  if (validation.error) {
    return { error: validation.error };
  }

  const { error } = await supabase.auth.signUp({
    email: validation.data!.email,
    password: validation.data!.password,
    options: {
      data: {
        name: validation.data!.name,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // Success: no error
  return { error: null };
}

export async function logout() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function getSession() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  return data.session;
}
