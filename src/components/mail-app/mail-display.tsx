import * as React from "react"
import { addDays, addHours, format, nextSaturday } from "date-fns"
import {
  Archive,
  ArchiveX,
  Clock,
  Forward,
  MoreVertical,
  MousePointerClickIcon,
  Reply,
  ReplyAll,
  Send,
  Trash2,
  X
} from "lucide-react"
import { DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { useMailStore, type Message } from "./use-mail"
import { useTheme } from "@/lib/theme"

function isHtml(body: string, isHtmlFlag?: number) {
  if (isHtmlFlag === 1) return true
  if (isHtmlFlag === 0) return false
  return /<html|<!DOCTYPE|<body|<div|<p |<table|<span/i.test(body)
}

function cleanPlainText(body: string) {
  return body
    .replace(/^(Content-Type|Content-Transfer-Encoding|MIME-Version|Mime-Version|X-[A-Za-z-]+)[^\n]*\n/gim, "")
    .replace(/=\r?\n/g, "")
    .replace(/=[0-9A-Fa-f]{2}/g, c => {
      try { return String.fromCharCode(parseInt(c.slice(1), 16)) } catch { return c }
    })
    .trim()
}

function EmailBody({ body, isHtmlFlag }: { body: string; isHtmlFlag?: number }) {
  const iframeRef = React.useRef<HTMLIFrameElement>(null)
  const html = isHtml(body, isHtmlFlag)

  if (html) {
    return (
      <iframe
        ref={iframeRef}
        sandbox="allow-same-origin"
        className="w-full border-0"
        style={{ minHeight: 400, flex: 1 }}
        srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;font-size:14px;margin:16px;word-break:break-word;color:#111}img{max-width:100%}a{color:#2563eb}</style></head><body>${body}</body></html>`}
        onLoad={(e) => {
          try {
            const h = e.currentTarget.contentDocument?.body?.scrollHeight
            if (h) e.currentTarget.style.height = (h + 40) + "px"
          } catch {}
        }}
      />
    )
  }

  return (
    <div className="flex-1 p-4 text-sm whitespace-pre-wrap leading-relaxed">
      {cleanPlainText(body) || "(no content)"}
    </div>
  )
}

type ComposeMode = "reply" | "replyAll" | "forward" | null

export function MailDisplay({ mail }: { mail: Message | null }) {
  const { accounts, sendMail, trashMessage, archiveMessage, junkMessage } = useMailStore()
  const { theme } = useTheme()
  const [compose, setCompose] = React.useState<ComposeMode>(null)
  const [to, setTo] = React.useState("")
  const [subject, setSubject] = React.useState("")
  const [body, setBody] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const [sendError, setSendError] = React.useState("")
  const [replyText, setReplyText] = React.useState("")
  const today = new Date()

  const openCompose = (mode: ComposeMode) => {
    if (!mail) return
    setCompose(mode)
    setSendError("")
    if (mode === "reply") {
      setTo(mail.from_email)
      setSubject(mail.subject.startsWith("Re:") ? mail.subject : `Re: ${mail.subject}`)
      setBody(`\n\n--- Original message from ${mail.from_name || mail.from_email} ---\n${mail.body?.replace(/<[^>]*>/g, "").substring(0, 500)}`)
    } else if (mode === "replyAll") {
      setTo([mail.from_email, mail.to_email].filter(Boolean).join(", "))
      setSubject(mail.subject.startsWith("Re:") ? mail.subject : `Re: ${mail.subject}`)
      setBody(`\n\n--- Original message ---\n${mail.body?.replace(/<[^>]*>/g, "").substring(0, 500)}`)
    } else if (mode === "forward") {
      setTo("")
      setSubject(mail.subject.startsWith("Fwd:") ? mail.subject : `Fwd: ${mail.subject}`)
      setBody(`\n\n--- Forwarded message ---\nFrom: ${mail.from_email}\nSubject: ${mail.subject}\n\n${mail.body?.replace(/<[^>]*>/g, "")}`)
    }
  }

  const handleSend = async () => {
    if (!mail || !to.trim()) return
    setSending(true)
    setSendError("")
    try {
      const accountId = mail.account_id || accounts[0]?.id
      if (!accountId) throw new Error("No account to send from")
      await sendMail(accountId, to, subject, body, mail.id)
      setCompose(null)
    } catch (e: any) {
      setSendError(e.message)
    } finally {
      setSending(false)
    }
  }

  const handleQuickReply = async () => {
    if (!mail || !replyText.trim()) return
    setSending(true)
    setSendError("")
    try {
      const accountId = mail.account_id || accounts[0]?.id
      if (!accountId) throw new Error("No account to send from")
      const replySubject = mail.subject.startsWith("Re:") ? mail.subject : `Re: ${mail.subject}`
      await sendMail(accountId, mail.from_email, replySubject, replyText, mail.id)
      setReplyText("")
    } catch (e: any) {
      setSendError(e.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mail-theme-reader flex h-full flex-col">
      {/* Toolbar */}
      <div className="mail-theme-toolbar flex items-center gap-2 p-2">
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" disabled={!mail} onClick={() => mail && archiveMessage(mail)}>
                <Archive />
                <span className="sr-only">Archive</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Archive</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" disabled={!mail} onClick={() => mail && junkMessage(mail)}>
                <ArchiveX />
                <span className="sr-only">Move to junk</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Move to junk</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" disabled={!mail} onClick={() => mail && trashMessage(mail)}>
                <Trash2 />
                <span className="sr-only">Move to trash</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Move to trash</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" />

        <Tooltip>
          <Popover>
            <PopoverTrigger asChild>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" disabled={!mail}>
                  <Clock />
                  <span className="sr-only">Snooze</span>
                </Button>
              </TooltipTrigger>
            </PopoverTrigger>
            <PopoverContent className="flex w-[535px] p-0">
              <div className="flex flex-col gap-2 border-r px-2 py-4">
                <div className="px-4 text-sm font-medium">Snooze until</div>
                <div className="grid min-w-[250px] gap-1">
                  <Button variant="ghost" className="justify-start font-normal">
                    Later today{" "}
                    <span className="text-muted-foreground ml-auto">
                      {format(addHours(today, 4), "E, h:m b")}
                    </span>
                  </Button>
                  <Button variant="ghost" className="justify-start font-normal">
                    Tomorrow
                    <span className="text-muted-foreground ml-auto">
                      {format(addDays(today, 1), "E, h:m b")}
                    </span>
                  </Button>
                  <Button variant="ghost" className="justify-start font-normal">
                    This weekend
                    <span className="text-muted-foreground ml-auto">
                      {format(nextSaturday(today), "E, h:m b")}
                    </span>
                  </Button>
                  <Button variant="ghost" className="justify-start font-normal">
                    Next week
                    <span className="text-muted-foreground ml-auto">
                      {format(addDays(today, 7), "E, h:m b")}
                    </span>
                  </Button>
                </div>
              </div>
              <div className="p-2">
                <Calendar />
              </div>
            </PopoverContent>
          </Popover>
          <TooltipContent>Snooze</TooltipContent>
        </Tooltip>

        <div className="ml-auto flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" disabled={!mail} onClick={() => openCompose("reply")}>
                <Reply />
                <span className="sr-only">Reply</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reply</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" disabled={!mail} onClick={() => openCompose("replyAll")}>
                <ReplyAll />
                <span className="sr-only">Reply all</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reply all</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" disabled={!mail} onClick={() => openCompose("forward")}>
                <Forward />
                <span className="sr-only">Forward</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Forward</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" disabled={!mail}>
              <MoreVertical />
              <span className="sr-only">More</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Mark as unread</DropdownMenuItem>
            <DropdownMenuItem>Star thread</DropdownMenuItem>
            <DropdownMenuItem>Add label</DropdownMenuItem>
            <DropdownMenuItem>Mute thread</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Separator />

      {mail ? (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-start p-4">
            <div className="flex items-start gap-4 text-sm">
              <Avatar className={theme === "muse" ? "h-12 w-12" : ""}>
                <AvatarFallback>
                  {(mail.from_name || mail.from_email)
                    .split(" ")
                    .map((chunk) => chunk[0])
                    .join("")
                    .toUpperCase()
                    .substring(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="grid gap-1">
                {theme === "muse" ? (
                  <>
                    <div className="text-3xl font-semibold tracking-tight">{mail.subject}</div>
                    <div className="flex items-center gap-2 pt-1">
                      <Badge variant="secondary">Work</Badge>
                      <Badge variant="outline">Important</Badge>
                    </div>
                    <div className="pt-4 text-lg font-semibold">{mail.from_name || mail.from_email}</div>
                    <div className="line-clamp-1 text-base text-muted-foreground">&lt;{mail.from_email}&gt;</div>
                    <div className="line-clamp-1 text-base text-muted-foreground">to {mail.to_email || "you"} • {format(new Date(mail.date), "d MMM, HH:mm")}</div>
                  </>
                ) : (
                  <>
                    <div className="font-semibold">{mail.from_name || mail.from_email}</div>
                    <div className="line-clamp-1 text-xs">{mail.subject}</div>
                    <div className="line-clamp-1 text-xs">
                      <span className="font-medium">Reply-To:</span> {mail.from_email}
                    </div>
                  </>
                )}
              </div>
            </div>
            {mail.date && theme !== "muse" && (
              <div className="text-muted-foreground ml-auto text-xs">
                {format(new Date(mail.date), "PPpp")}
              </div>
            )}
          </div>
          <Separator />

          {/* Body */}
          <div className="flex-1 overflow-auto">
            <EmailBody body={mail.body || ""} isHtmlFlag={(mail as any).is_html} />
          </div>

          {/* Compose panel (when reply/forward clicked) */}
          {compose && (
            <>
              <Separator />
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium capitalize">{compose}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCompose(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="w-12 shrink-0 text-xs text-muted-foreground">To</Label>
                    <Input className="h-7 text-sm" value={to} onChange={e => setTo(e.target.value)} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="w-12 shrink-0 text-xs text-muted-foreground">Subject</Label>
                    <Input className="h-7 text-sm" value={subject} onChange={e => setSubject(e.target.value)} />
                  </div>
                  <Textarea className="min-h-[100px] text-sm" value={body} onChange={e => setBody(e.target.value)} />
                </div>
                {sendError && <p className="text-xs text-destructive">{sendError}</p>}
                <div className="flex items-center">
                  <Label htmlFor="mute-compose" className="flex items-center gap-2 text-xs font-normal">
                    <Switch id="mute-compose" aria-label="Mute thread" /> Mute this thread
                  </Label>
                  <Button size="sm" disabled={sending || !to.trim()} onClick={handleSend} className="ml-auto">
                    <Send className="mr-2 h-3.5 w-3.5" />
                    {sending ? "Sending…" : "Send"}
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Quick reply area (shadcn style - always visible when not in compose mode) */}
          {!compose && (
            <>
              <Separator className="mt-auto" />
              <div className="p-4">
                <form onSubmit={(e) => { e.preventDefault(); handleQuickReply() }}>
                  <div className="grid gap-4">
                    <Textarea
                      className="p-4"
                      placeholder={`Reply ${mail.from_name || mail.from_email}...`}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                    />
                    <div className="flex items-center">
                      <Label htmlFor="mute" className="flex items-center gap-2 text-xs font-normal">
                        <Switch id="mute" aria-label="Mute thread" /> Mute this thread
                      </Label>
                      <Button
                        onClick={(e) => { e.preventDefault(); handleQuickReply() }}
                        size="sm"
                        className="ml-auto"
                        disabled={sending || !replyText.trim()}>
                        {sending ? "Sending…" : "Send"}
                      </Button>
                    </div>
                  </div>
                </form>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
          <MousePointerClickIcon className="size-8 opacity-50" />
          No message selected
        </div>
      )}
    </div>
  )
}
