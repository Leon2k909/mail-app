import * as React from "react"
import { Search } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TooltipProvider } from "@/components/ui/tooltip"
import { MailDisplay } from "./mail-display"
import { MailDisplayMobile } from "./mail-display-mobile"
import { MailList } from "./mail-list"
import { useMailStore, type Message } from "./use-mail"
import { NavDesktop } from "./nav-desktop"
import { NavMobile } from "./nav-mobile"
import { SettingsPage } from "./settings-page"
import { DisposableMail } from "./disposable-mail"
import { useTheme } from "@/lib/theme"

function baseSubject(subject: string) {
  return subject.replace(/^(Re|Fwd|Fw):\s*/gi, "").trim().toLowerCase()
}

function groupIntoThreads(messages: Message[]): (Message & { threadCount: number })[] {
  const threads = new Map<string, { msg: Message; count: number }>()
  for (const m of messages) {
    const key = baseSubject(m.subject || "")
    const existing = threads.get(key)
    if (!existing || m.date > existing.msg.date) {
      threads.set(key, { msg: m, count: (existing?.count || 0) + 1 })
    } else {
      existing.count++
    }
  }
  return Array.from(threads.values())
    .sort((a, b) => b.msg.date - a.msg.date)
    .map(({ msg, count }) => ({ ...msg, threadCount: count }))
}

type View = "mail" | "settings" | "disposable"

export function Mail() {
  const [isCollapsed, setIsCollapsed] = React.useState(false)
  const [tab, setTab] = React.useState("all")
  const [search, setSearch] = React.useState("")
  const [view, setView] = React.useState<View>("mail")
  const isMobile = useIsMobile()
  const { selectedMail, fetchAccounts, messages, activeFolder } = useMailStore()
  const { theme, resolvedTheme } = useTheme()

  React.useEffect(() => { fetchAccounts() }, [])

  React.useEffect(() => {
    const onSettings = () => setView("settings")
    const onDisposable = () => setView("disposable")
    document.addEventListener("open-settings", onSettings)
    document.addEventListener("open-disposable-mail", onDisposable)
    return () => {
      document.removeEventListener("open-settings", onSettings)
      document.removeEventListener("open-disposable-mail", onDisposable)
    }
  }, [])

  const filtered = React.useMemo(() => {
    let list = messages
    if (tab === "unread") list = list.filter(m => !m.read)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(m =>
        m.subject?.toLowerCase().includes(q) ||
        m.from_name?.toLowerCase().includes(q) ||
        m.from_email?.toLowerCase().includes(q)
      )
    }
    return groupIntoThreads(list)
  }, [messages, tab, search])

  const sidebar = (
    <ResizablePanel
      hidden={isMobile}
      defaultSize={20}
      collapsedSize={4}
      collapsible
      minSize={15}
      maxSize={20}
      onCollapse={() => {
        setIsCollapsed(true)
        document.cookie = `react-resizable-panels:collapsed=${JSON.stringify(true)}`
      }}
      onResize={() => {
        setIsCollapsed(false)
        document.cookie = `react-resizable-panels:collapsed=${JSON.stringify(false)}`
      }}
      className={cn(isCollapsed && "min-w-[50px] transition-all duration-300 ease-in-out")}>
      <NavDesktop
        isCollapsed={isCollapsed}
        onSettings={() => setView("settings")}
        activeView={view}
      />
    </ResizablePanel>
  )

  return (
    <TooltipProvider delayDuration={0}>
      <div className={cn("mail-theme-shell h-full", theme === "muse" && "mail-theme-shell-muse", theme === "volt" && "mail-theme-shell-volt")}>
      <ResizablePanelGroup
        direction="horizontal"
        onLayout={(sizes) => { document.cookie = `react-resizable-panels:layout:mail=${JSON.stringify(sizes)}` }}
        className="mail-theme-panels items-stretch">

        {sidebar}
        <ResizableHandle hidden={isMobile} withHandle />

        {/* Settings — spans remaining space */}
        {view === "settings" && (
          <ResizablePanel defaultSize={80} minSize={50} className="mail-theme-main-panel">
            <SettingsPage onBack={() => setView("mail")} />
          </ResizablePanel>
        )}

        {/* Disposable mail — spans remaining space */}
        {view === "disposable" && (
          <ResizablePanel defaultSize={80} minSize={50} className="mail-theme-main-panel">
            <DisposableMail isDark={resolvedTheme === "dark" || theme === "volt"} />
          </ResizablePanel>
        )}

        {/* Normal mail view */}
        {view === "mail" && (
          <>
            <ResizablePanel defaultSize={32} minSize={30} className="mail-theme-list-panel">
              <Tabs value={tab} onValueChange={setTab} className="flex h-full flex-col gap-0">
                <div className="mail-theme-header flex items-center px-4 py-2">
                  <div className="flex items-center gap-2">
                    {isMobile && <NavMobile />}
                    {theme !== "muse" && <h1 className="text-xl font-bold">{activeFolder}</h1>}
                  </div>
                  <TabsList className="ml-auto">
                    <TabsTrigger value="all">All mail</TabsTrigger>
                    <TabsTrigger value="unread">Unread</TabsTrigger>
                  </TabsList>
                </div>
                <Separator />
                <div className="mail-theme-search bg-background/95 supports-[backdrop-filter]:bg-background/60 p-4 backdrop-blur">
                  <div className="relative">
                    <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
                    <Input
                      placeholder="Search"
                      className="pl-8"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="min-h-0 flex-1">
                  <MailList items={filtered} />
                </div>
              </Tabs>
            </ResizablePanel>
            <ResizableHandle hidden={isMobile} withHandle />
            <ResizablePanel defaultSize={48} hidden={isMobile} minSize={30} className="mail-theme-reader-panel">
              {isMobile ? (
                <MailDisplayMobile mail={selectedMail} />
              ) : (
                <MailDisplay mail={selectedMail} />
              )}
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
      </div>
    </TooltipProvider>
  )
}
