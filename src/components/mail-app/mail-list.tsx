import * as React from "react"
import { ComponentProps } from "react"
import { formatDistanceToNow } from "date-fns"
import { useMailStore, type Message } from "./use-mail"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useTheme } from "@/lib/theme"

function getBadgeVariantFromLabel(label: string): ComponentProps<typeof Badge>["variant"] {
  if (["work"].includes(label.toLowerCase())) {
    return "default"
  }
  if (["personal"].includes(label.toLowerCase())) {
    return "outline"
  }
  return "secondary"
}

export function MailList({ items }: { items: (Message & { threadCount?: number })[] }) {
  const { selectedMail, setSelectedMail, markRead, loadingMore, hasMore, fetchMore, loading, error } = useMailStore()
  const { theme } = useTheme()
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const checkAndLoad = React.useCallback(() => {
    const el = scrollRef.current
    if (!el || !hasMore || loadingMore) return
    const { scrollTop, scrollHeight, clientHeight } = el
    if (scrollHeight - scrollTop - clientHeight < 400) {
      fetchMore()
    }
  }, [hasMore, loadingMore, fetchMore])

  // Scroll event
  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener("scroll", checkAndLoad, { passive: true })
    return () => el.removeEventListener("scroll", checkAndLoad)
  }, [checkAndLoad])

  // After new messages load, check if we're still near bottom (short list or fast scroll)
  React.useEffect(() => {
    if (!loadingMore) {
      // Small delay to let DOM update
      const t = setTimeout(checkAndLoad, 100)
      return () => clearTimeout(t)
    }
  }, [items.length, loadingMore, checkAndLoad])

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  )

  if (error) return (
    <div className="flex h-full items-center justify-center p-4 text-center text-sm text-destructive">{error}</div>
  )

  if (items.length === 0) return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No messages</div>
  )

  return (
    <ScrollArea ref={scrollRef} className="h-full">
      <div className="flex flex-col gap-2 p-4 pt-0">
        {items.map((item) => {
          // Extract simple labels from subject keywords for visual badges
          const labels = extractLabels(item)
          const initials = (item.from_name || item.from_email)
            .split(" ")
            .map((chunk) => chunk[0])
            .join("")
            .toUpperCase()
            .substring(0, 2)
          return (
            <button
              key={item.id}
              data-selected={selectedMail?.id === item.id}
              className={cn(
                "mail-theme-list-item hover:bg-accent/70 flex flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm transition-all",
                selectedMail?.id === item.id && "bg-accent/70"
              )}
              onClick={() => {
                setSelectedMail(item)
                if (!item.read) markRead(item.id)
              }}>
              <div className="flex w-full gap-3">
                <div className="muse-message-avatar flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-xs font-bold text-white">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex w-full flex-col gap-1">
                    <div className="flex items-center">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold">
                          {item.from_name || item.from_email}
                        </div>
                        {!item.read && <span className="flex h-2 w-2 rounded-full bg-blue-600" />}
                      </div>
                      <div className={cn(
                        "ml-auto text-xs",
                        selectedMail?.id === item.id ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {theme === "muse" ? museRelativeTime(item.date) : formatDistanceToNow(new Date(item.date), { addSuffix: true })}
                      </div>
                    </div>
                    <div className="text-xs font-medium">
                      {item.subject}
                      {(item as any).threadCount > 1 && (
                        <span className="ml-1.5 text-muted-foreground font-normal">({(item as any).threadCount})</span>
                      )}
                    </div>
                  </div>
                  <div className="text-muted-foreground line-clamp-2 pt-1 text-xs">
                    {item.body?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().substring(0, 300)}
                  </div>
                  {labels.length > 0 && (
                    <div className="flex items-center gap-2 pt-2">
                      {labels.map((label) => (
                        <Badge key={label} variant={getBadgeVariantFromLabel(label)}>
                          {label}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </button>
          )
        })}

        <div className="flex justify-center py-3">
          {loadingMore && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {!loadingMore && !hasMore && (
            <span className="text-xs text-muted-foreground">{items.length.toLocaleString()} messages</span>
          )}
        </div>
      </div>
    </ScrollArea>
  )
}

function museRelativeTime(date: number) {
  const diffDays = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return "Today"
  if (diffDays < 7) return `${diffDays}d`
  return "Last week"
}

// Extract simple labels from email metadata for badge display
function extractLabels(item: Message): string[] {
  const labels: string[] = []
  const subject = (item.subject || "").toLowerCase()
  const from = (item.from_email || "").toLowerCase()

  if (subject.includes("meeting") || subject.includes("invite") || subject.includes("calendar")) {
    labels.push("meeting")
  }
  if (subject.includes("important") || subject.includes("urgent") || subject.includes("action required")) {
    labels.push("important")
  }
  if (from.includes("noreply") || from.includes("newsletter") || from.includes("marketing") || from.includes("promo")) {
    labels.push("promotions")
  }
  if (subject.includes("invoice") || subject.includes("payment") || subject.includes("order") || subject.includes("receipt")) {
    labels.push("work")
  }

  return labels.slice(0, 3) // Max 3 labels
}
