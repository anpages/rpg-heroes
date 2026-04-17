const STORAGE_KEY = 'rpg-accounts'

export function getSavedAccounts() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch { return [] }
}

export function saveAccount(session) {
  const { user, access_token, refresh_token } = session
  if (!access_token || !refresh_token) return
  const accounts = getSavedAccounts()
  const entry = {
    id: user.id,
    email: user.email,
    name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email,
    avatar_url: user.user_metadata?.avatar_url ?? null,
    access_token,
    refresh_token,
  }
  const idx = accounts.findIndex(a => a.id === user.id)
  if (idx >= 0) accounts[idx] = entry
  else accounts.push(entry)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts))
}

export function removeAccount(userId) {
  const accounts = getSavedAccounts().filter(a => a.id !== userId)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts))
}
