import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { ReactNode } from "react"
import { buttonVariants } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface NavProps {
  isCollapsed: boolean
  activeFolder?: string
  onSelect?: (title: string) => void
  links: {
    title: string
    label?: string
    icon: LucideIcon
    dot?: ReactNode
    variant: "default" | "ghost"
  }[]
}

export function Nav({ links, isCollapsed, activeFolder, onSelect }: NavProps) {
  return (
    <div
      data-collapsed={isCollapsed}
      className="group flex flex-col gap-4 py-2 data-[collapsed=true]:py-2">
      <nav className="grid gap-1 px-2 group-[[data-collapsed=true]]:justify-center group-[[data-collapsed=true]]:px-2">
        {links.map((link, index) => {
          const isActive = activeFolder ? activeFolder === link.title : link.variant === "default"
          const effectiveVariant = isActive ? "default" : "ghost"
          return isCollapsed ? (
            <Tooltip key={index} delayDuration={0}>
              <TooltipTrigger asChild>
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); onSelect?.(link.title) }}
                  data-active={isActive}
                  className={cn(
                    buttonVariants({ variant: effectiveVariant, size: "icon" }),
                    "mail-theme-nav-link h-9 w-9",
                    isActive &&
                      "dark:bg-muted dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-white"
                  )}>
                  {link.dot ?? <link.icon className="size-4" />}
                  <span className="sr-only">{link.title}</span>
                </a>
              </TooltipTrigger>
              <TooltipContent side="right" className="flex items-center gap-4">
                {link.title}
                {link.label && <span className="text-muted-foreground ml-auto">{link.label}</span>}
              </TooltipContent>
            </Tooltip>
          ) : (
            <a
              key={index}
              href="#"
              onClick={(e) => { e.preventDefault(); onSelect?.(link.title) }}
              data-active={isActive}
              className={cn(
                buttonVariants({ variant: effectiveVariant, size: "sm" }),
                isActive &&
                  "dark:bg-muted dark:hover:bg-muted dark:text-white dark:hover:text-white",
                "mail-theme-nav-link justify-start"
              )}>
              {link.dot ?? <link.icon className="mr-2 h-4 w-4" />}
              {link.title}
              {link.label && (
                <span
                  className={cn(
                    "ml-auto",
                    isActive && "text-background dark:text-white"
                  )}>
                  {link.label}
                </span>
              )}
            </a>
          )
        })}
      </nav>
    </div>
  )
}
