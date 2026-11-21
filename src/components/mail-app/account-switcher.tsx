import * as React from "react"
import { Check, ChevronDown, Inbox, Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useMailStore, ALL_ACCOUNT_ID } from "./use-mail"

interface AccountSwitcherProps {
  isCollapsed: boolean
}

export function AccountSwitcher({ isCollapsed }: AccountSwitcherProps) {
  const { accounts, selectedAccountId, selectAccount, removeAccount } = useMailStore()
  const [open, setOpen] = React.useState(false)

  const selected = selectedAccountId === ALL_ACCOUNT_ID
    ? null
    : accounts.find(a => a.id === selectedAccountId)

  const label = selected ? selected.label : "All Inboxes"
  const initial = selected ? selected.email[0].toUpperCase() : "✉"

  if (isCollapsed) {
    return (
      <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => selectAccount(ALL_ACCOUNT_ID)}>
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
          {initial}
        </span>
      </Button>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/50 transition-colors">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {initial}
          </span>
          <span className="flex-1 truncate text-left font-medium">{label}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1" align="start">
        {/* All Inboxes */}
        <button
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
            selectedAccountId === ALL_ACCOUNT_ID && "bg-accent"
          )}
          onClick={() => { selectAccount(ALL_ACCOUNT_ID); setOpen(false) }}>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
            <Inbox className="h-3.5 w-3.5" />
          </span>
          <div className="flex-1 text-left">
            <div className="font-medium">All Inboxes</div>
            <div className="text-xs text-muted-foreground">{accounts.length} account{accounts.length !== 1 ? "s" : ""}</div>
          </div>
          {selectedAccountId === ALL_ACCOUNT_ID && <Check className="h-4 w-4" />}
        </button>

        {accounts.length > 0 && <div className="my-1 h-px bg-border" />}

        {/* Individual accounts */}
        {accounts.map(acc => (
          <div key={acc.id} className="flex items-center gap-1">
            <button
              className={cn(
                "flex flex-1 items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
                selectedAccountId === acc.id && "bg-accent"
              )}
              onClick={() => { selectAccount(acc.id); setOpen(false) }}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {acc.email[0].toUpperCase()}
              </span>
              <div className="flex-1 min-w-0 text-left">
                <div className="font-medium truncate">{acc.label}</div>
                <div className="text-xs text-muted-foreground truncate">{acc.email}</div>
              </div>
              {selectedAccountId === acc.id && <Check className="h-4 w-4 shrink-0" />}
            </button>
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); removeAccount(acc.id) }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}

        <div className="my-1 h-px bg-border" />

        {/* Add account — opens settings */}
        <button
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onClick={() => { setOpen(false); document.dispatchEvent(new CustomEvent("open-settings")) }}>
          <Plus className="h-4 w-4" />
          Add account
        </button>
      </PopoverContent>
    </Popover>
  )
}
