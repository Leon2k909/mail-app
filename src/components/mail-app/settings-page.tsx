import { useState, useEffect } from "react"
import { ArrowLeft, Bell, Check, FileText, Filter, Mail, Menu, Palette, Shield, Sliders, Trash2, User } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useMailStore } from "./use-mail"
import { useTheme, type Appearance, type Theme } from "@/lib/theme"

const sections = [
  { id: "accounts", label: "Accounts", icon: Mail },
  { id: "profile", label: "Profile", icon: User },
  { id: "signature", label: "Signature", icon: FileText },
  { id: "rules", label: "Rules", icon: Filter },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "preferences", label: "Preferences", icon: Sliders },
  { id: "security", label: "Security", icon: Shield },
]

export function SettingsPage({ onBack }: { onBack: () => void }) {
  const [active, setActive] = useState("accounts")
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // If opened via "Add account" link, jump straight to accounts tab
  useEffect(() => {
    const handler = () => setActive("accounts")
    document.addEventListener("open-settings", handler)
    return () => document.removeEventListener("open-settings", handler)
  }, [])

  return (
    <div className="mail-theme-settings bg-background flex h-screen">
      {/* Sidebar */}
      <div className={cn(
        "mail-theme-settings-sidebar bg-card fixed inset-y-0 left-0 z-40 w-56 border-r transition-transform duration-200 lg:static lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-[52px] items-center gap-2 border-b px-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold">Settings</span>
        </div>
        <nav className="space-y-1 p-3">
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setActive(id); setSidebarOpen(false) }}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active === id
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              )}>
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Content */}
      <div className="mail-theme-settings-content flex-1 overflow-auto">
        <div className="flex h-[52px] items-center gap-2 border-b px-4 lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="h-8 w-8">
            <Menu className="h-4 w-4" />
          </Button>
          <span className="font-semibold">Settings</span>
        </div>
        <div className="mx-auto max-w-2xl p-6 space-y-6">
          {active === "accounts" && <AccountsSection />}
          {active === "profile" && <ProfileSection />}
          {active === "signature" && <SignatureSection />}
          {active === "rules" && <RulesSection />}
          {active === "notifications" && <NotificationsSection />}
          {active === "preferences" && <PreferencesSection />}
          {active === "security" && <SecuritySection />}
        </div>
      </div>
    </div>
  )
}

function AccountsSection() {
  const { accounts, removeAccount, addAccount, loading } = useMailStore()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ email: "", password: "", label: "", imap_host: "", smtp_host: "" })
  const [addError, setAddError] = useState("")

  useEffect(() => {
    const handler = () => setShowAdd(true)
    document.addEventListener("open-settings-add", handler)
    return () => document.removeEventListener("open-settings-add", handler)
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddError("")
    try {
      await addAccount({ ...form, type: "imap" })
      setShowAdd(false)
      setForm({ email: "", password: "", label: "", imap_host: "", smtp_host: "" })
    } catch (err: any) { setAddError(err.message) }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Email Accounts</h1>
      <Card>
        <CardHeader>
          <CardTitle>Connected accounts</CardTitle>
          <CardDescription>Manage your email accounts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {accounts.length === 0 && <p className="text-sm text-muted-foreground">No accounts connected yet.</p>}
          {accounts.map(acc => (
            <div key={acc.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">{acc.email[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-sm font-medium">{acc.label}</div>
                  <div className="text-xs text-muted-foreground">{acc.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">IMAP</Badge>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeAccount(acc.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {!showAdd && (
            <Button variant="outline" className="w-full" onClick={() => setShowAdd(true)}>+ Add account</Button>
          )}
          {showAdd && (
            <form onSubmit={handleAdd} className="space-y-3 rounded-lg border p-4">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input placeholder="you@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Password / App password</Label>
                <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Display name (optional)</Label>
                <Input placeholder="Work, Personal…" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground">Custom IMAP/SMTP servers</summary>
                <div className="mt-2 space-y-2">
                  <Input placeholder="IMAP host (e.g. imap.ionos.co.uk)" value={form.imap_host} onChange={e => setForm(f => ({ ...f, imap_host: e.target.value }))} />
                  <Input placeholder="SMTP host (e.g. smtp.ionos.co.uk)" value={form.smtp_host} onChange={e => setForm(f => ({ ...f, smtp_host: e.target.value }))} />
                </div>
              </details>
              {addError && <p className="text-sm text-destructive">{addError}</p>}
              <div className="flex gap-2">
                <Button type="submit" disabled={loading} className="flex-1">{loading ? "Connecting…" : "Add account"}</Button>
                <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ProfileSection() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Profile</h1>
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg">U</AvatarFallback>
            </Avatar>
            <Button variant="outline" size="sm">Change avatar</Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Display name</Label><Input defaultValue="" placeholder="Your name" /></div>
            <div className="space-y-1.5"><Label>Signature name</Label><Input defaultValue="" placeholder="e.g. John Smith" /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Email signature</Label>
            <textarea className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Your email signature…" />
          </div>
          <div className="flex justify-end"><Button>Save</Button></div>
        </CardContent>
      </Card>
    </div>
  )
}

function NotificationsSection() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Notifications</h1>
      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">New email notifications</h3>
              <p className="text-sm text-muted-foreground">Get notified when new emails arrive</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Unread badge</h3>
              <p className="text-sm text-muted-foreground">Show unread count in the taskbar</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="space-y-3">
            <h3 className="font-medium">Notify me about</h3>
            <RadioGroup defaultValue="all" className="space-y-3">
              <div className="flex items-start gap-3">
                <RadioGroupItem value="all" id="n-all" className="mt-0.5" />
                <div><Label htmlFor="n-all" className="font-medium">All new emails</Label><p className="text-sm text-muted-foreground">Notify for every incoming email</p></div>
              </div>
              <div className="flex items-start gap-3">
                <RadioGroupItem value="important" id="n-imp" className="mt-0.5" />
                <div><Label htmlFor="n-imp" className="font-medium">Important only</Label><p className="text-sm text-muted-foreground">Only emails marked as important</p></div>
              </div>
              <div className="flex items-start gap-3">
                <RadioGroupItem value="none" id="n-none" className="mt-0.5" />
                <div><Label htmlFor="n-none" className="font-medium">None</Label><p className="text-sm text-muted-foreground">Turn off all notifications</p></div>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function PreferencesSection() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Preferences</h1>
      <Card>
        <CardContent className="space-y-6 p-6">
          <ThemePicker />
          <Separator />
          <div className="space-y-1.5">
            <Label>Reading pane</Label>
            <Select defaultValue="right">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="right">Right</SelectItem>
                <SelectItem value="bottom">Bottom</SelectItem>
                <SelectItem value="off">Off</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Mark as read on open</h3>
              <p className="text-sm text-muted-foreground">Automatically mark emails as read when opened</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="space-y-1.5">
            <Label>Emails per page</Label>
            <Select defaultValue="50">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Show images automatically</h3>
              <p className="text-sm text-muted-foreground">Load remote images in emails</p>
            </div>
            <Switch />
          </div>
          <div className="flex justify-end"><Button>Save</Button></div>
        </CardContent>
      </Card>
    </div>
  )
}

function SecuritySection() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Security</h1>
      <Card>
        <CardHeader>
          <CardTitle>Account security</CardTitle>
          <CardDescription>Manage how your account credentials are stored</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <h4 className="font-medium">Encrypted credential storage</h4>
              <p className="text-sm text-muted-foreground">Passwords are AES-256 encrypted on the server</p>
            </div>
            <Badge variant="secondary" className="bg-green-100 text-green-700">Active</Badge>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <h4 className="font-medium">IMAP over TLS</h4>
              <p className="text-sm text-muted-foreground">All email connections use TLS encryption</p>
            </div>
            <Badge variant="secondary" className="bg-green-100 text-green-700">Active</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

const themeOptions: { id: Theme; name: string; description: string; swatch: string }[] = [
  { id: "classic", name: "Classic", description: "The current app theme.", swatch: "linear-gradient(135deg, #ffffff 0%, #eef2f7 100%)" },
  { id: "muse", name: "Muse Mail", description: "Violet slate look from MailApp.tsx.", swatch: "linear-gradient(135deg, #f8fafc 0%, #ede9fe 55%, #c4b5fd 100%)" },
  { id: "volt", name: "VoltMail", description: "Gold-on-graphite look from mailapp.html.", swatch: "linear-gradient(135deg, #0c0e14 0%, #1a1d2b 60%, #e8a838 100%)" },
]

function ThemePicker() {
  const { theme, appearance, setTheme, setAppearance } = useTheme()

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="bg-secondary text-secondary-foreground flex h-9 w-9 items-center justify-center rounded-lg">
          <Palette className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-medium">Theme</h3>
          <p className="text-sm text-muted-foreground">Switch the whole app style, not just the accent colors.</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {themeOptions.map(option => {
          const selected = theme === option.id
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setTheme(option.id)}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors hover:bg-secondary/40",
                selected && "border-primary ring-primary/20 bg-secondary/30 ring-2"
              )}>
              <div className="mb-3 h-20 rounded-lg border" style={{ background: option.swatch }} />
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{option.name}</div>
                  <div className="text-sm text-muted-foreground">{option.description}</div>
                </div>
                {selected && <Check className="text-primary h-4 w-4 shrink-0" />}
              </div>
            </button>
          )
        })}
      </div>
      {theme === "classic" && <ClassicAppearancePicker appearance={appearance} onChange={setAppearance} />}
    </div>
  )
}

function ClassicAppearancePicker({ appearance, onChange }: { appearance: Appearance; onChange: (appearance: Appearance) => void }) {
  return (
    <div className="space-y-2 rounded-xl border p-3">
      <div>
        <div className="font-medium">Classic appearance</div>
        <div className="text-sm text-muted-foreground">Keep the original app theme, with light or dark mode.</div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {(["light", "dark"] as const).map((option) => {
          const selected = appearance === option
          return (
            <Button
              key={option}
              type="button"
              variant={selected ? "default" : "outline"}
              className="justify-start"
              onClick={() => onChange(option)}>
              {option === "light" ? "Light mode" : "Dark mode"}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

function SignatureSection() {
  const [signatures, setSignatures] = useState([
    { id: "1", name: "Default", content: "", isDefault: true }
  ])
  const [editing, setEditing] = useState<string | null>("1")

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Signatures</h1>
      <Card>
        <CardHeader>
          <CardTitle>Email signatures</CardTitle>
          <CardDescription>Signatures are automatically appended to new emails</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {signatures.map(sig => (
            <div key={sig.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Input
                    className="h-7 w-40 text-sm"
                    value={sig.name}
                    onChange={e => setSignatures(s => s.map(x => x.id === sig.id ? { ...x, name: e.target.value } : x))}
                  />
                  {sig.isDefault && <Badge variant="secondary">Default</Badge>}
                </div>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => setEditing(editing === sig.id ? null : sig.id)}>
                  {editing === sig.id ? "Collapse" : "Edit"}
                </Button>
              </div>
              {editing === sig.id && (
                <textarea
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder={"Type your signature here…\n\nBest regards,\nYour Name"}
                  value={sig.content}
                  onChange={e => setSignatures(s => s.map(x => x.id === sig.id ? { ...x, content: e.target.value } : x))}
                />
              )}
            </div>
          ))}
          <Button
            variant="outline" className="w-full"
            onClick={() => {
              const id = Date.now().toString()
              setSignatures(s => [...s, { id, name: "New signature", content: "", isDefault: false }])
              setEditing(id)
            }}>
            + Add signature
          </Button>
          <div className="flex justify-end"><Button>Save</Button></div>
        </CardContent>
      </Card>
    </div>
  )
}

function RulesSection() {
  const [rules, setRules] = useState([
    { id: "1", name: "Move newsletters to Archive", condition: "subject contains 'unsubscribe'", action: "Move to Archive", enabled: true },
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Rules</h1>
      <Card>
        <CardHeader>
          <CardTitle>Inbox rules</CardTitle>
          <CardDescription>Automatically organise incoming emails</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rules.map(rule => (
            <div key={rule.id} className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-1 flex-1 min-w-0">
                <div className="font-medium text-sm">{rule.name}</div>
                <div className="text-xs text-muted-foreground">If {rule.condition} → {rule.action}</div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <Switch
                  checked={rule.enabled}
                  onCheckedChange={v => setRules(r => r.map(x => x.id === rule.id ? { ...x, enabled: v } : x))}
                />
                <Button
                  variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                  onClick={() => setRules(r => r.filter(x => x.id !== rule.id))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          <Button variant="outline" className="w-full" onClick={() => {
            setRules(r => [...r, {
              id: Date.now().toString(),
              name: "New rule",
              condition: "from contains ''",
              action: "Move to Inbox",
              enabled: true
            }])
          }}>+ Add rule</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick filters</CardTitle>
          <CardDescription>Pre-built rules for common scenarios</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "Auto-archive newsletters", desc: "Emails with unsubscribe links go to Archive" },
            { label: "Flag emails from contacts", desc: "Mark emails from your contacts as important" },
            { label: "Block promotional emails", desc: "Move promotional emails to Junk" },
          ].map(({ label, desc }) => (
            <div key={label} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs text-muted-foreground">{desc}</div>
              </div>
              <Button variant="outline" size="sm" onClick={() => {
                setRules(r => [...r, { id: Date.now().toString(), name: label, condition: desc, action: "Auto", enabled: true }])
              }}>Enable</Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
