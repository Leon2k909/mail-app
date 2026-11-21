import { Archive, ArchiveX, File, Inbox, MenuIcon, Send, Trash2, Users2, AlertCircle, MessagesSquare, ShoppingCart } from "lucide-react"
import { Nav } from "./nav"
import { Separator } from "@/components/ui/separator"
import { AccountSwitcher } from "./account-switcher"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { useMailStore } from "./use-mail"

export function NavMobile() {
  const { activeFolder, setActiveFolder, accounts, selectedAccountId, folderStatus } = useMailStore()

  const unseen = (imapFolder: string) => {
    const accsToCheck = selectedAccountId === "all"
      ? accounts
      : accounts.filter(a => a.id === selectedAccountId)
    const total = accsToCheck.reduce((sum, acc) => {
      return sum + (folderStatus[`${acc.id}:${imapFolder}`]?.unseen || 0)
    }, 0)
    return total > 0 ? (total > 999 ? "999+" : String(total)) : ""
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon"><MenuIcon /></Button>
      </SheetTrigger>
      <SheetContent side="left" className="overflow-auto [&>button:first-of-type]:hidden">
        <VisuallyHidden>
          <DialogHeader><DialogTitle>Navigation</DialogTitle></DialogHeader>
        </VisuallyHidden>
        <div className="flex h-[52px] items-center justify-center px-2">
          <AccountSwitcher isCollapsed={false} />
        </div>
        <Separator />
        <Nav
          isCollapsed={false}
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

        <Separator />

        <Nav
          isCollapsed={false}
          activeFolder={activeFolder}
          onSelect={setActiveFolder}
          links={[
            {
              title: "Social",
              label: "972",
              icon: Users2,
              dot: <span className="me-2 size-3.5 rounded-full bg-indigo-400 dark:bg-indigo-700" />,
              variant: "ghost"
            },
            {
              title: "Updates",
              label: "342",
              icon: AlertCircle,
              dot: <span className="me-2 size-3.5 rounded-full bg-teal-400 dark:bg-teal-700" />,
              variant: "ghost"
            },
            {
              title: "Forums",
              label: "128",
              icon: MessagesSquare,
              dot: <span className="me-2 size-3.5 rounded-full bg-orange-400 dark:bg-orange-700" />,
              variant: "ghost"
            },
            {
              title: "Shopping",
              label: "8",
              icon: ShoppingCart,
              dot: <span className="me-2 size-3.5 rounded-full bg-lime-400 dark:bg-lime-700" />,
              variant: "ghost"
            },
            {
              title: "Promotions",
              label: "21",
              icon: Archive,
              dot: <span className="me-2 size-3.5 rounded-full bg-pink-400 dark:bg-pink-700" />,
              variant: "ghost"
            }
          ]}
        />
      </SheetContent>
    </Sheet>
  )
}
