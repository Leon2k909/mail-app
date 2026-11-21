import { create } from "zustand"

// The mail backend runs inside the app (electron/backend.cjs) and talks to
// IMAP/SMTP straight from this PC. Calls keep their old HTTP-style paths but go
// over IPC; nothing is sent to a server of ours.
export const API = "/api"

type ApiResult = { status: number; data: any }
type MailBridge = (req: { method: string; path: string; body?: unknown }) => Promise<ApiResult>

async function apiFetch(url: string, options: RequestInit = {}) {
  const bridge: MailBridge | undefined = (window as any).electron?.mailApi
  if (!bridge) throw new Error("Mail only works inside the desktop app")
  const body = typeof options.body === "string" ? JSON.parse(options.body) : undefined
  const r = await bridge({ method: (options.method || "GET").toUpperCase(), path: url.slice(API.length), body })
  return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.data }
}

export type Message = {
  id: string
  account_id: string
  folder: string
  uid: number
  subject: string
  from_name: string
  from_email: string
  to_email: string
  date: number
  body: string
  is_html: number
  read: number
  flagged: number
}

export type Account = {
  id: string
  label: string
  email: string
  type: string
}

export type FolderStatus = {
  total: number
  unseen: number
}

export type AddAccountData = {
  label?: string
  email: string
  type: string
  imap_host?: string
  imap_port?: number
  smtp_host?: string
  smtp_port?: number
  username?: string
  password: string
}

const ALL_ID = "all"
export const ALL_ACCOUNT_ID = ALL_ID

const FOLDER_MAP: Record<string, string> = {
  Inbox: "INBOX", Drafts: "Drafts", Sent: "Sent", Junk: "Junk", Trash: "Trash", Archive: "Archive",
}

const PAGE_SIZE = 100

type MailStore = {
  accounts: Account[]
  selectedAccountId: string
  folderStatus: Record<string, FolderStatus>  // key = "accountId:folder"
  messages: Message[]
  selectedMail: Message | null
  activeFolder: string
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  error: string | null

  fetchAccounts: () => Promise<void>
  addAccount: (data: AddAccountData) => Promise<void>
  removeAccount: (id: string) => Promise<void>
  selectAccount: (id: string) => void
  fetchMessages: (accountId: string, folder?: string, reset?: boolean) => Promise<void>
  fetchMore: () => Promise<void>
  fetchFolderStatus: (accountId: string, folder?: string) => Promise<void>
  setSelectedMail: (mail: Message | null) => void
  setActiveFolder: (folder: string) => void
  markRead: (msgId: string) => Promise<void>
  trashMessage: (msg: Message) => Promise<void>
  archiveMessage: (msg: Message) => Promise<void>
  junkMessage: (msg: Message) => Promise<void>
  sendMail: (accountId: string, to: string, subject: string, text: string, replyTo?: string) => Promise<void>
}

export const useMailStore = create<MailStore>((set, get) => ({
  accounts: [],
  selectedAccountId: ALL_ID,
  folderStatus: {},
  messages: [],
  selectedMail: null,
  activeFolder: "Inbox",
  loading: false,
  loadingMore: false,
  hasMore: true,
  error: null,

  fetchAccounts: async () => {
    try {
      const res = await apiFetch(`${API}/accounts`)
      const accounts = await res.json()
      set({ accounts })
      if (accounts.length > 0) {
        get().fetchMessages(ALL_ID, "Inbox", true)
        // Fetch status for all accounts
        for (const acc of accounts) {
          get().fetchFolderStatus(acc.id, "INBOX")
        }
      }
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  fetchFolderStatus: async (accountId, folder = "INBOX") => {
    try {
      const res = await apiFetch(`${API}/accounts/${accountId}/status?folder=${folder}`)
      if (!res.ok) return
      const status: FolderStatus = await res.json()
      const key = `${accountId}:${folder}`
      set((s) => ({ folderStatus: { ...s.folderStatus, [key]: status } }))
    } catch {}
  },

  addAccount: async (data) => {
    set({ loading: true, error: null })
    const res = await apiFetch(`${API}/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!res.ok) { set({ loading: false, error: json.error }); throw new Error(json.error) }
    set((s) => ({ accounts: [...s.accounts, json], loading: false }))
    get().fetchFolderStatus(json.id, "INBOX")
    get().fetchMessages(get().selectedAccountId, get().activeFolder, true)
  },

  removeAccount: async (id) => {
    await apiFetch(`${API}/accounts/${id}`, { method: "DELETE" })
    set((s) => ({ accounts: s.accounts.filter(a => a.id !== id) }))
    get().fetchMessages(ALL_ID, "Inbox", true)
    set({ selectedAccountId: ALL_ID })
  },

  selectAccount: (id) => {
    set({ selectedAccountId: id, messages: [], selectedMail: null })
    get().fetchMessages(id, get().activeFolder, true)
  },

  fetchMessages: async (accountId, folder = "Inbox", reset = true) => {
    const imapFolder = FOLDER_MAP[folder] || folder
    if (reset) set({ loading: true, error: null, messages: [], hasMore: true })

    try {
      const url = accountId === ALL_ID
        ? `${API}/all-accounts/messages?folder=${imapFolder}&limit=${PAGE_SIZE}&offset=0`
        : `${API}/accounts/${accountId}/messages?folder=${imapFolder}&limit=${PAGE_SIZE}&offset=0`

      const res = await apiFetch(url)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const msgs: Message[] = Array.isArray(data)
        ? data.map((m: any) => ({ ...m, folder }))
        : []

      set({ messages: msgs, loading: false, hasMore: msgs.length > 0 })
    } catch (e: any) {
      set({ loading: false, error: e.message })
    }
  },

  fetchMore: async () => {
    const { messages, selectedAccountId, activeFolder, loadingMore, hasMore } = get()
    if (loadingMore || !hasMore) return
    set({ loadingMore: true })

    const imapFolder = FOLDER_MAP[activeFolder] || activeFolder
    const offset = messages.length

    try {
      const url = selectedAccountId === ALL_ID
        ? `${API}/all-accounts/messages?folder=${imapFolder}&limit=${PAGE_SIZE}&offset=${offset}`
        : `${API}/accounts/${selectedAccountId}/messages?folder=${imapFolder}&limit=${PAGE_SIZE}&offset=${offset}`

      const res = await apiFetch(url)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const newMsgs: Message[] = Array.isArray(data)
        ? data.map((m: any) => ({ ...m, folder: activeFolder }))
        : []

      set((s) => ({
        messages: [...s.messages, ...newMsgs],
        loadingMore: false,
        hasMore: newMsgs.length > 0,
      }))
    } catch {
      set({ loadingMore: false })
    }
  },

  setSelectedMail: (mail) => set({ selectedMail: mail }),

  setActiveFolder: (folder) => {
    set({ activeFolder: folder, messages: [], selectedMail: null })
    const { selectedAccountId, accounts } = get()
    const imapFolder = FOLDER_MAP[folder] || folder
    get().fetchMessages(selectedAccountId, folder, true)
    // Refresh status for this folder
    if (selectedAccountId === ALL_ID) {
      for (const acc of accounts) get().fetchFolderStatus(acc.id, imapFolder)
    } else {
      get().fetchFolderStatus(selectedAccountId, imapFolder)
    }
  },

  markRead: async (msgId) => {
    set((s) => ({
      messages: s.messages.map(m => m.id === msgId ? { ...m, read: 1 } : m),
      selectedMail: s.selectedMail?.id === msgId ? { ...s.selectedMail, read: 1 } : s.selectedMail,
    }))
    const msg = get().messages.find(m => m.id === msgId) || get().selectedMail
    if (!msg) return
    await apiFetch(`${API}/accounts/${msg.account_id}/messages/${encodeURIComponent(msgId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    }).catch(() => {})
  },

  archiveMessage: async (msg) => {
    set((s) => ({
      messages: s.messages.filter(m => m.id !== msg.id),
      selectedMail: s.selectedMail?.id === msg.id ? null : s.selectedMail,
    }))
    const imapFolder = FOLDER_MAP[get().activeFolder] || get().activeFolder
    await apiFetch(`${API}/accounts/${msg.account_id}/messages/${msg.uid}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: imapFolder }),
    }).catch(() => {})
  },

  junkMessage: async (msg) => {
    set((s) => ({
      messages: s.messages.filter(m => m.id !== msg.id),
      selectedMail: s.selectedMail?.id === msg.id ? null : s.selectedMail,
    }))
    const imapFolder = FOLDER_MAP[get().activeFolder] || get().activeFolder
    await apiFetch(`${API}/accounts/${msg.account_id}/messages/${msg.uid}/junk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: imapFolder }),
    }).catch(() => {})
  },

  trashMessage: async (msg) => {
    set((s) => ({
      messages: s.messages.filter(m => m.id !== msg.id),
      selectedMail: s.selectedMail?.id === msg.id ? null : s.selectedMail,
    }))
    const imapFolder = FOLDER_MAP[get().activeFolder] || get().activeFolder
    await apiFetch(`${API}/accounts/${msg.account_id}/messages/${msg.uid}/trash`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: imapFolder }),
    }).catch(() => {})
  },

  sendMail: async (accountId, to, subject, text, replyTo) => {
    const res = await apiFetch(`${API}/accounts/${accountId}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, text, replyTo }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error)
  },
}))
