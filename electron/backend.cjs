// Mail backend that runs inside the app (Electron main process).
//
// The app used to call a backend on a server of ours, which
// logged in to the mailboxes on its behalf. That server is gone: this file does
// the same job on the user's own PC, talking IMAP/SMTP straight to the mail
// provider. The renderer reaches it over IPC (see main.cjs / preload.cjs) with
// the same paths the old HTTP API had, so use-mail.ts barely changed.
//
// Storage lives in the app's userData folder:
//   accounts.json          account settings; passwords encrypted by the OS
//                          (Electron safeStorage = Windows DPAPI)
//   cache/<id>/<folder>    last fetched first page, shown when offline
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const dns = require('dns').promises
const { ImapFlow } = require('imapflow')
const nodemailer = require('nodemailer')

const PRESETS = {
  'gmail.com': ['imap.gmail.com', 'smtp.gmail.com'],
  'googlemail.com': ['imap.gmail.com', 'smtp.gmail.com'],
  'outlook.com': ['outlook.office365.com', 'smtp.office365.com'],
  'hotmail.com': ['outlook.office365.com', 'smtp.office365.com'],
  'hotmail.co.uk': ['outlook.office365.com', 'smtp.office365.com'],
  'live.com': ['outlook.office365.com', 'smtp.office365.com'],
  'msn.com': ['outlook.office365.com', 'smtp.office365.com'],
  'yahoo.com': ['imap.mail.yahoo.com', 'smtp.mail.yahoo.com'],
  'ymail.com': ['imap.mail.yahoo.com', 'smtp.mail.yahoo.com'],
  'icloud.com': ['imap.mail.me.com', 'smtp.mail.me.com'],
  'me.com': ['imap.mail.me.com', 'smtp.mail.me.com'],
  'mac.com': ['imap.mail.me.com', 'smtp.mail.me.com'],
}

// Own domains hosted by a known provider: work out the servers from the MX
// record, e.g. mx00.ionos.co.uk → imap.ionos.co.uk / smtp.ionos.co.uk.
async function hostsFromMx(domain) {
  try {
    const mx = (await dns.resolveMx(domain)).sort((a, b) => a.priority - b.priority)
    for (const { exchange } of mx) {
      const host = exchange.toLowerCase().replace(/\.$/, '')
      const ionos = host.match(/(?:^|\.)ionos\.(co\.uk|de|com|fr|es|it|mx|ca)$/)
      if (ionos) return [`imap.ionos.${ionos[1]}`, `smtp.ionos.${ionos[1]}`]
      if (host.endsWith('.google.com') || host.endsWith('.googlemail.com')) return ['imap.gmail.com', 'smtp.gmail.com']
      if (host.endsWith('.protection.outlook.com')) return ['outlook.office365.com', 'smtp.office365.com']
    }
  } catch {}
  return null
}

const TRASH = ['Trash', 'INBOX.Trash', '[Gmail]/Trash', 'Deleted Items', 'Deleted Messages']
const ARCHIVE = ['Archive', 'INBOX.Archive', '[Gmail]/All Mail', 'Archived']
const JUNK = ['Junk', 'Spam', 'INBOX.Junk', '[Gmail]/Spam', 'Junk Email']

// ── MIME parser (from the old server; bodies now decoded in their charset,
//    so "£" no longer shows up as "Â£") ─────────────────────────────────────
function charsetOf(contentType) {
  const m = (contentType || '').match(/charset=["']?([^"';\s]+)/i)
  return m ? m[1].toLowerCase() : 'utf-8'
}
function bytesToText(buf, charset) {
  try { return new TextDecoder(charset).decode(buf) } catch { return buf.toString('utf8') }
}
function decodeBody(raw, encoding, charset) {
  const enc = (encoding || '').toLowerCase().trim()
  if (enc === 'quoted-printable') {
    const bin = raw.replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    return bytesToText(Buffer.from(bin, 'latin1'), charset)
  }
  if (enc === 'base64') {
    try { return bytesToText(Buffer.from(raw.replace(/\s/g, ''), 'base64'), charset) } catch { return raw }
  }
  return raw
}
function getHeader(headers, name) {
  const match = headers.match(new RegExp(`^${name}:\\s*(.+?)(?=\\n[^\\s]|$)`, 'im'))
  return match ? match[1].replace(/\n\s+/g, ' ').trim() : null
}
function extractBoundary(contentType) {
  const m = contentType.match(/boundary=["']?([^"';\s\r\n]+)["']?/i)
  return m ? m[1] : null
}
function escapeRegex(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
function parseMultipart(body, boundary, depth = 0) {
  if (depth > 5) return { body: '', isHtml: false }
  const parts = body.split(new RegExp(`\\n?--${escapeRegex(boundary)}(?:--)?\\n?`))
  let htmlPart = null, plainPart = null
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed || trimmed === '--') continue
    const blankLine = trimmed.indexOf('\n\n')
    if (blankLine === -1) continue
    const partHeaders = trimmed.substring(0, blankLine)
    const partBody = trimmed.substring(blankLine + 2)
    const ct = getHeader(partHeaders, 'content-type') || ''
    const enc = getHeader(partHeaders, 'content-transfer-encoding') || ''
    if (ct.toLowerCase().includes('multipart')) {
      const sub = extractBoundary(ct)
      if (sub) {
        const r = parseMultipart(partBody, sub, depth + 1)
        if (r.isHtml && !htmlPart) htmlPart = r.body
        else if (!r.isHtml && r.body && !plainPart) plainPart = r.body
      }
    } else if (ct.toLowerCase().includes('text/html')) {
      const d = decodeBody(partBody, enc, charsetOf(ct))
      if (d && d.trim()) htmlPart = d
    } else if (ct.toLowerCase().includes('text/plain')) {
      const d = decodeBody(partBody, enc, charsetOf(ct))
      if (d && d.trim()) plainPart = d
    }
  }
  if (htmlPart) return { body: htmlPart, isHtml: true }
  if (plainPart) return { body: plainPart, isHtml: false }
  return { body: '', isHtml: false }
}
function parseRawEmail(raw) {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const blankLine = normalized.indexOf('\n\n')
  if (blankLine === -1) return { body: raw, isHtml: false }
  const headerSection = normalized.substring(0, blankLine)
  const bodySection = normalized.substring(blankLine + 2)
  const contentType = getHeader(headerSection, 'content-type') || 'text/plain'
  const encoding = getHeader(headerSection, 'content-transfer-encoding') || ''
  if (contentType.toLowerCase().includes('multipart')) {
    const boundary = extractBoundary(contentType)
    if (boundary) {
      const result = parseMultipart(bodySection, boundary)
      if (result.body) return result
    }
  }
  const isHtml = contentType.toLowerCase().includes('text/html')
  const decoded = decodeBody(bodySection, encoding, charsetOf(contentType))
  if (!isHtml && decoded.match(/^--[^\s]+\s*\n/m)) {
    const bm = decoded.match(/^--([^\s\r\n]+)/m)
    if (bm) {
      const result = parseMultipart(decoded, bm[1])
      if (result.body) return result
    }
  }
  return { body: decoded, isHtml }
}

// ── Backend ───────────────────────────────────────────────────────────────────
// encrypt/decrypt may be async (Electron's safeStorage async API is).
function createBackend({ dataDir, encrypt, decrypt }) {
  const accountsFile = path.join(dataDir, 'accounts.json')
  const cacheRoot = path.join(dataDir, 'cache')
  fs.mkdirSync(cacheRoot, { recursive: true })

  function writeJson(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const tmp = `${file}.${process.pid}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(value))
    fs.renameSync(tmp, file)
  }
  function readJson(file, fallback) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return fallback }
  }
  const loadAccounts = () => readJson(accountsFile, [])
  const saveAccounts = (list) => writeJson(accountsFile, list)
  const findAccount = (id) => loadAccounts().find(a => a.id === id) || null
  const publicAccount = (a) => ({ id: a.id, label: a.label, email: a.email, type: a.type })

  const cacheFile = (accountId, folder) => path.join(cacheRoot, accountId, `${encodeURIComponent(folder)}.json`)
  function cacheGet(accountId, folder, limit, offset) {
    return readJson(cacheFile(accountId, folder), []).slice(offset, offset + limit)
  }
  function cachePut(accountId, folder, messages) {
    try { writeJson(cacheFile(accountId, folder), messages) } catch {}
  }
  function cacheUpdate(accountId, folder, fn) {
    const file = cacheFile(accountId, folder)
    const list = readJson(file, null)
    if (list) { try { writeJson(file, fn(list)) } catch {} }
  }

  function imapClient(account, password) {
    const port = account.imap_port || 993
    return new ImapFlow({
      host: account.imap_host,
      port,
      secure: port === 993,
      auth: { user: account.username || account.email, pass: password },
      logger: false,
    })
  }

  async function withImap(account, fn) {
    const client = imapClient(account, await decrypt(account.password_enc))
    await client.connect()
    try { return await fn(client) } finally { try { await client.logout() } catch {} }
  }

  // The app asks for "Sent", "Junk", "Trash"…; providers name them differently
  // (e.g. "Sent Items", "Spam"). Use the folder's IMAP special-use role first.
  const SPECIAL = { Sent: '\\Sent', Drafts: '\\Drafts', Junk: '\\Junk', Trash: '\\Trash', Archive: '\\Archive' }
  const folderLists = new Map() // accountId → { at, boxes }
  async function mailboxes(client, account) {
    const hit = folderLists.get(account.id)
    if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.boxes
    const boxes = await client.list()
    folderLists.set(account.id, { at: Date.now(), boxes })
    return boxes
  }
  async function resolveFolder(client, account, folder) {
    if (folder.toUpperCase() === 'INBOX') return 'INBOX'
    const boxes = await mailboxes(client, account)
    if (boxes.some(b => b.path === folder)) return folder
    const role = SPECIAL[folder]
    const special = role && boxes.find(b => b.specialUse === role)
    return special ? special.path : folder
  }
  async function lockFolder(client, account, folder) {
    return client.getMailboxLock(await resolveFolder(client, account, folder))
  }

  async function fetchMessages(account, folder, limit, offset) {
    return withImap(account, async (client) => {
      const lock = await lockFolder(client, account, folder)
      const messages = []
      try {
        const total = client.mailbox.exists
        if (total === 0 || offset >= total) return []
        const seqEnd = Math.max(1, total - offset)
        const seqStart = Math.max(1, seqEnd - limit + 1)
        for await (const msg of client.fetch(`${seqStart}:${seqEnd}`, { envelope: true, flags: true, source: true })) {
          const env = msg.envelope || {}
          const parsed = msg.source ? parseRawEmail(msg.source.toString()) : { body: '', isHtml: false }
          messages.push({
            id: `${account.id}-${folder}-${msg.uid}`,
            account_id: account.id,
            folder,
            uid: msg.uid,
            subject: env.subject || '(no subject)',
            from_name: env.from?.[0]?.name || env.from?.[0]?.address || '',
            from_email: env.from?.[0]?.address || '',
            to_email: env.to?.map(t => t.address).join(', ') || '',
            date: env.date ? new Date(env.date).getTime() : Date.now(),
            body: parsed.body,
            is_html: parsed.isHtml ? 1 : 0,
            read: msg.flags?.has('\\Seen') ? 1 : 0,
            flagged: msg.flags?.has('\\Flagged') ? 1 : 0,
          })
        }
      } finally { lock.release() }
      return messages.reverse()
    })
  }

  async function listMessages(account, folder, limit, offset) {
    try {
      const messages = await fetchMessages(account, folder, limit, offset)
      if (offset === 0) cachePut(account.id, folder, messages)
      return messages
    } catch {
      return cacheGet(account.id, folder, limit, offset)
    }
  }

  // Only Trash falls back to deleting when no folder is found; Archive/Junk
  // fail instead (the old server deleted the mail in that case too).
  async function moveMessage(account, uid, folder, target) {
    await withImap(account, async (client) => {
      const boxes = await mailboxes(client, account)
      const special = boxes.find(b => b.specialUse === SPECIAL[target])
      const names = { Trash: TRASH, Archive: ARCHIVE, Junk: JUNK }[target]
      const candidates = [...new Set([special?.path, ...names].filter(Boolean))]
        .filter(p => p === special?.path || boxes.some(b => b.path === p))
      const lock = await lockFolder(client, account, folder)
      try {
        let moved = false
        for (const dest of candidates) {
          try { if (await client.messageMove({ uid }, dest, { uid: true })) { moved = true; break } } catch {}
        }
        if (!moved) {
          if (target !== 'Trash') throw new Error(`No ${target} folder on this account`)
          await client.messageDelete({ uid }, { uid: true })
        }
      } finally { lock.release() }
    })
    cacheUpdate(account.id, folder, list => list.filter(m => m.uid !== uid))
  }

  async function addAccount(body) {
    const { label, email, type, imap_host, imap_port, smtp_host, smtp_port, username, password } = body || {}
    if (!email || !type) return [400, { error: 'email and type required' }]
    const address = String(email).trim()
    const domain = address.split('@')[1]?.toLowerCase()
    if (!domain) return [400, { error: 'Enter a full email address' }]
    if (loadAccounts().some(a => a.email.toLowerCase() === address.toLowerCase())) {
      return [400, { error: `${address} is already added` }]
    }

    let imapHost = (imap_host || '').trim(), smtpHost = (smtp_host || '').trim()
    if (!imapHost) {
      const found = PRESETS[domain] || await hostsFromMx(domain) || [`imap.${domain}`, `smtp.${domain}`]
      imapHost = found[0]
      if (!smtpHost) smtpHost = found[1]
    }
    if (!smtpHost) smtpHost = imapHost.replace(/^imap\./, 'smtp.')

    const account = {
      id: crypto.randomUUID(),
      label: (label || '').trim() || address,
      email: address,
      type,
      imap_host: imapHost,
      imap_port: parseInt(imap_port) || 993,
      smtp_host: smtpHost,
      smtp_port: parseInt(smtp_port) || 587,
      username: (username || '').trim() || address,
      created_at: Date.now(),
    }

    try {
      const client = imapClient(account, password || '')
      await client.connect()
      await client.logout()
    } catch (err) {
      return [400, { error: `Connection failed (${imapHost}): ${err.responseText || err.message}` }]
    }

    account.password_enc = password ? await encrypt(password) : ''
    saveAccounts([...loadAccounts(), account])
    return [200, publicAccount(account)]
  }

  // Message ids are `${accountId}-${folder}-${uid}`; folders can contain '-'.
  function splitMessageId(account, msgId) {
    const prefix = `${account.id}-`
    if (!msgId.startsWith(prefix)) return null
    const m = msgId.slice(prefix.length).match(/^(.*)-(\d+)$/)
    return m ? { folder: m[1], uid: parseInt(m[2]) } : null
  }

  async function route(method, pathname, query, body) {
    const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent)
    const folder = query.get('folder') || 'INBOX'
    const limit = Math.min(parseInt(query.get('limit')) || 100, 500)
    const offset = Math.max(parseInt(query.get('offset')) || 0, 0)

    if (parts[0] === 'all-accounts' && parts[1] === 'messages' && method === 'GET') {
      const accounts = loadAccounts()
      if (accounts.length === 0) return [200, []]
      const perAccount = Math.ceil(limit / accounts.length) + 5
      const lists = await Promise.all(accounts.map(a => listMessages(a, folder, perAccount, offset)))
      return [200, lists.flat().sort((a, b) => b.date - a.date).slice(0, limit)]
    }

    if (parts[0] !== 'accounts') return [404, { error: 'Not found' }]
    if (parts.length === 1) {
      if (method === 'GET') return [200, loadAccounts().map(publicAccount)]
      if (method === 'POST') return addAccount(body)
      return [405, { error: 'Method not allowed' }]
    }

    const account = findAccount(parts[1])
    if (!account) return [404, { error: 'Not found' }]
    const action = parts[2]

    if (!action && method === 'DELETE') {
      saveAccounts(loadAccounts().filter(a => a.id !== account.id))
      fs.rmSync(path.join(cacheRoot, account.id), { recursive: true, force: true })
      return [200, { ok: true }]
    }

    if (action === 'status' && method === 'GET') {
      const st = await withImap(account, async c => c.status(await resolveFolder(c, account, folder), { messages: true, unseen: true }))
      return [200, { total: st.messages || 0, unseen: st.unseen || 0 }]
    }

    if (action === 'folders' && method === 'GET') {
      const list = await withImap(account, c => c.list())
      return [200, list.map(f => ({ name: f.name, path: f.path }))]
    }

    if (action === 'send' && method === 'POST') {
      const { to, subject, text, html, replyTo } = body || {}
      const transporter = nodemailer.createTransport({
        host: account.smtp_host,
        port: account.smtp_port || 587,
        secure: account.smtp_port === 465,
        auth: { user: account.username || account.email, pass: await decrypt(account.password_enc) },
      })
      const opts = { from: `${account.label} <${account.email}>`, to, subject, text, html }
      if (replyTo) opts.inReplyTo = replyTo
      await transporter.sendMail(opts)
      return [200, { ok: true }]
    }

    if (action === 'messages') {
      if (parts.length === 3 && method === 'GET') return [200, await listMessages(account, folder, limit, offset)]

      if (parts.length === 5 && method === 'POST') {
        const target = { trash: 'Trash', archive: 'Archive', junk: 'Junk' }[parts[4]]
        const uid = parseInt(parts[3])
        if (!target || !uid) return [404, { error: 'Not found' }]
        await moveMessage(account, uid, (body && body.folder) || 'INBOX', target)
        return [200, { ok: true }]
      }

      // Read / flagged state goes to the mailbox itself, so it sticks.
      if (parts.length === 4 && method === 'PATCH') {
        const ref = splitMessageId(account, parts[3])
        if (!ref) return [404, { error: 'Not found' }]
        const { read, flagged } = body || {}
        await withImap(account, async (client) => {
          const lock = await lockFolder(client, account, ref.folder)
          try {
            if (read !== undefined) await (read ? client.messageFlagsAdd : client.messageFlagsRemove).call(client, { uid: ref.uid }, ['\\Seen'], { uid: true })
            if (flagged !== undefined) await (flagged ? client.messageFlagsAdd : client.messageFlagsRemove).call(client, { uid: ref.uid }, ['\\Flagged'], { uid: true })
          } finally { lock.release() }
        })
        cacheUpdate(account.id, ref.folder, list => list.map(m => m.uid !== ref.uid ? m : {
          ...m,
          ...(read !== undefined ? { read: read ? 1 : 0 } : {}),
          ...(flagged !== undefined ? { flagged: flagged ? 1 : 0 } : {}),
        }))
        return [200, { ok: true }]
      }
    }

    return [404, { error: 'Not found' }]
  }

  // Entry point for IPC: { method, path, body } → { status, data }
  async function handle(req) {
    try {
      const method = String(req?.method || 'GET').toUpperCase()
      const url = new URL(String(req?.path || '/'), 'http://mail.local')
      const [status, data] = await route(method, url.pathname, url.searchParams, req?.body)
      return { status, data }
    } catch (err) {
      return { status: 500, data: { error: err.responseText || err.message || String(err) } }
    }
  }

  return { handle }
}

module.exports = { createBackend, parseRawEmail }
