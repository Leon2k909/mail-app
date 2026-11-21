import { Archive, ArchiveX, File, Inbox, Send, Settings, ShieldOff, Trash2 } from "lucide-react"
import { Nav } from "./nav"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { AccountSwitcher } from "./account-switcher"
import { useMailStore } from "./use-mail"
import { useTheme } from "@/lib/theme"

interface NavDesktopProps {
  isCollapsed: boolean
  onSettings: () => void
  activeView?: string
}

export function NavDesktop({ isCollapsed, onSettings, activeView }: NavDesktopProps) {
  const { activeFolder, setActiveFolder, accounts, selectedAccountId, folderStatus } = useMailStore()
  const { theme } = useTheme()

  const unseen = (imapFolder: string) => {
    const accsToCheck = selectedAccountId === "all"
      ? accounts
      : accounts.filter(a => a.id === selectedAccountId)
    const total = accsToCheck.reduce((sum, acc) => {
      return sum + (folderStatus[`${acc.id}:${imapFolder}`]?.unseen || 0)
    }, 0)
    return total > 0 ? (total > 999 ? "999+" : String(total)) : ""
  }

  if (theme === "muse" && !isCollapsed) {
    return (
      <div className="muse-sidebar flex h-full flex-col">
        <div className="muse-sidebar-brand px-4 pt-4">
          <div className="flex items-center gap-3">
            <div className="muse-sidebar-logo grid h-10 w-10 place-items-center rounded-2xl text-sm font-bold text-white">✉</div>
            <div>
              <div className="text-[1.75rem] leading-none font-semibold tracking-tight">Muse Mail</div>
              <div className="text-sm text-muted-foreground">Calm inbox, zero noise</div>
            </div>
          </div>
        </div>

        <div className="px-4 pt-5">
          <Button className="muse-compose-button h-11 w-full justify-center text-lg font-semibold">
            <span className="mr-1 text-xl">+</span>
            Compose
          </Button>
        </div>

        <div className="px-3 pt-3">
          <Nav
            isCollapsed={false}
            activeFolder={activeFolder}
            onSelect={setActiveFolder}
            links={[
              { title: "Inbox", label: unseen("INBOX"), icon: Inbox, variant: "default" },
              { title: "Starred", label: "3", icon: ArchiveX, variant: "ghost" },
              { title: "Sent", label: "", icon: Send, variant: "ghost" },
              { title: "Drafts", label: unseen("Drafts"), icon: File, variant: "ghost" },
              { title: "Archive", label: "", icon: Archive, variant: "ghost" },
              { title: "Trash", label: "", icon: Trash2, variant: "ghost" },
            ]}
          />
        </div>

        <div className="px-6 pt-6">
          <div className="muse-labels-title">Labels</div>
          <div className="mt-4 space-y-4 text-[15px]">
            {[
              ["#8b5cf6", "Work"],
              ["#10b981", "Personal"],
              ["#f59e0b", "Finance"],
              ["#0ea5e9", "Travel"],
            ].map(([color, label]) => (
              <div key={label} className="flex items-center gap-3 text-slate-700">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto px-4 pb-4">
          <div className="muse-account-footer flex items-center gap-3 rounded-3xl border px-3 py-3">
            <img
              alt="Profile"
              src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=96&q=80"
              className="h-11 w-11 rounded-full object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-semibold">Ava Park</div>
              <div className="text-sm text-muted-foreground">Free plan</div>
            </div>
            <button type="button" className="text-slate-500" onClick={onSettings}>
              <Settings className="h-4 w-4" />
            </button>
            <button type="button" className="text-slate-500">☾</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className={cn("mail-theme-sidebar-header flex h-[52px] items-center justify-center", isCollapsed ? "h-[52px]" : "px-2")}>
        <AccountSwitcher isCollapsed={isCollapsed} />
      </div>
      <Separator />
      <Nav
        isCollapsed={isCollapsed}
        activeFolder={activeFolder}
        onSelect={setActiveFolder}
        links={[
          { title: "Inbox",   label: unseen("INBOX"),  icon: Inbox,    variant: "default" },
          { title: "Drafts",  label: unseen("Drafts"), icon: File,     variant: "ghost" },
          { title: "Sent",    label: "",               icon: Send,     variant: "ghost" },
          { title: "Junk",    label: unseen("Junk"),   icon: ArchiveX, variant: "ghost" },
          { title: "Trash",   label: "",               icon: Trash2,   variant: "ghost" },
          { title: "Archive", label: "",               icon: Archive,  variant: "ghost" },
        ]}
      />
      <div className="mt-auto p-2 flex flex-col gap-1">
        <Button
          variant={activeView === "disposable" ? "secondary" : "ghost"}
          size={isCollapsed ? "icon" : "sm"}
          className={cn("w-full", !isCollapsed && "justify-start gap-2")}
          onClick={() => document.dispatchEvent(new CustomEvent("open-disposable-mail"))}>
          <ShieldOff className="h-4 w-4" />
          {!isCollapsed && <span>Disposable Mail</span>}
        </Button>
        <Button
          variant={activeView === "settings" ? "secondary" : "ghost"}
          size={isCollapsed ? "icon" : "sm"}
          className={cn("w-full", !isCollapsed && "justify-start gap-2")}
          onClick={onSettings}>
          <Settings className="h-4 w-4" />
          {!isCollapsed && <span>Settings</span>}
        </Button>
      </div>
    </>
  )
}
