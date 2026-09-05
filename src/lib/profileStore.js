import { supabase } from './supabase'

// Gère l'accès aux profils via Supabase (fonctions RPC).
// Chaque profil est identifié par un CODE secret qui sert de clé d'accès.

export async function createProfile(code, name, aircraft) {
  const { data, error } = await supabase.rpc('create_profile', {
    p_code: code,
    p_name: name,
    p_aircraft: aircraft,
  })
  if (error) throw error
  if (data?.error === 'code_exists') {
    throw new Error('code_exists')
  }
  if (data?.error === 'code_too_short') {
    throw new Error('code_too_short')
  }
  return data
}

export async function getProfile(code) {
  const { data, error } = await supabase.rpc('get_profile', { p_code: code })
  if (error) throw error
  if (data?.error === 'locked') return { locked: true }
  if (data?.error === 'not_found') return null
  return data
}

export async function profileExists(code) {
  const { data, error } = await supabase.rpc('profile_exists', { p_code: code })
  if (error) throw error
  return data
}

export async function checkAdmin(code) {
  const { data, error } = await supabase.rpc('check_admin', { p_code: code })
  if (error) throw error
  return data
}

export async function setAdminCode(oldCode, newCode) {
  const { data, error } = await supabase.rpc('set_admin_code', {
    p_old: oldCode,
    p_new: newCode,
  })
  if (error) throw error
  return data
}

export async function saveProfileData(code, dataObj, rev = 0, force = false) {
  const { data, error } = await supabase.rpc('save_profile_data', {
    p_code: code,
    p_data: dataObj,
    p_rev: rev,
    p_force: force,
  })
  if (error) throw error
  return data
}

export async function updateProfileMeta(code, name, aircraft) {
  const { data, error } = await supabase.rpc('update_profile_meta', {
    p_code: code,
    p_name: name,
    p_aircraft: aircraft,
  })
  if (error) throw error
  return data
}

export async function deleteProfile(code) {
  const { data, error } = await supabase.rpc('delete_profile', { p_code: code })
  if (error) throw error
  return !!data
}
