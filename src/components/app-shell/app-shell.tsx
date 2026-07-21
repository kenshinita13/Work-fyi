"use client";

import {
  Activity,
  Bell,
  CalendarDays,
  ChevronsUpDown,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Layers3,
  ListTodo,
  LogOut,
  Mail,
  Menu,
  Plus,
  Search,
  Settings,
  Sparkles,
  Workflow,
} from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { signOutAction } from "@/lib/auth/actions";

const navigation = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
    ready: true,
  },
  { label: "Projects", icon: FolderKanban, ready: false },
  { label: "Tasks", icon: ListTodo, ready: false },
  { label: "Documents", icon: FileText, ready: false },
  { label: "AI Assistant", icon: Sparkles, ready: false },
  { label: "Calendar", icon: CalendarDays, ready: false },
  { label: "Email", icon: Mail, ready: false },
  { label: "Automations", icon: Workflow, ready: false },
  { label: "Monitoring", icon: Activity, ready: false },
  { label: "Integrations", icon: Layers3, ready: false },
  { label: "Settings", icon: Settings, ready: false },
] as const;

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function SidebarNavigation() {
  return (
    <nav className="grid gap-1 px-3" aria-label="Workspace navigation">
      {navigation.map((item) => {
        const Icon = item.icon;

        if (item.ready) {
          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex h-9 items-center gap-3 rounded-md bg-sidebar-accent px-3 text-sm font-medium text-sidebar-accent-foreground"
            >
              <Icon className="size-4" aria-hidden="true" />
              {item.label}
            </Link>
          );
        }

        return (
          <button
            key={item.label}
            type="button"
            disabled
            title={`${item.label} is coming soon`}
            className="flex h-9 w-full items-center gap-3 rounded-md px-3 text-left text-sm text-sidebar-foreground/55 disabled:cursor-not-allowed"
          >
            <Icon className="size-4" aria-hidden="true" />
            <span className="flex-1">{item.label}</span>
            <span className="text-[10px] font-medium text-sidebar-foreground/45 uppercase">
              Soon
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function Sidebar({ workspaceName }: { workspaceName: string }) {
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-3 px-5 font-semibold">
        <span className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
          <Layers3 className="size-4" aria-hidden="true" />
        </span>
        Work.fyi
      </div>
      <div className="px-3 pb-4">
        <Button
          variant="outline"
          className="h-auto w-full justify-between px-3 py-2"
          disabled
          title="Workspace switching will be available when you join another workspace"
        >
          <span className="min-w-0 text-left">
            <span className="block truncate text-sm font-medium">
              {workspaceName}
            </span>
            <span className="block text-xs text-muted-foreground">
              Workspace
            </span>
          </span>
          <ChevronsUpDown className="size-4" aria-hidden="true" />
        </Button>
      </div>
      <Separator />
      <div className="flex-1 overflow-y-auto py-3">
        <SidebarNavigation />
      </div>
      <div className="border-t border-sidebar-border px-5 py-4">
        <Badge variant="outline" className="font-normal text-muted-foreground">
          Phase 1 foundation
        </Badge>
      </div>
    </div>
  );
}

export function AppShell({
  children,
  workspaceName,
  userName,
  userEmail,
}: {
  children: React.ReactNode;
  workspaceName: string;
  userName: string;
  userEmail: string;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground md:grid md:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="hidden border-r border-sidebar-border md:block">
        <div className="sticky top-0 h-screen">
          <Sidebar workspaceName={workspaceName} />
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Open navigation"
              >
                <Menu className="size-5" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Workspace navigation</SheetTitle>
                <SheetDescription>Navigate Work.fyi modules.</SheetDescription>
              </SheetHeader>
              <Sidebar workspaceName={workspaceName} />
            </SheetContent>
          </Sheet>

          <div className="relative hidden max-w-md flex-1 sm:block">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              className="pl-9"
              placeholder="Search workspace"
              aria-label="Search workspace"
              disabled
              title="Global search is coming soon"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              disabled
              title="Quick create is coming in the Projects phase"
            >
              <Plus className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Create</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled
              title="Notifications are coming soon"
              aria-label="Notifications coming soon"
            >
              <Bell className="size-4" aria-hidden="true" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open user menu">
                  <Avatar className="size-8">
                    <AvatarFallback>{initials(userName)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <span className="block truncate">{userName}</span>
                  <span className="block truncate text-xs font-normal text-muted-foreground">
                    {userEmail}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <form action={signOutAction}>
                  <DropdownMenuItem asChild>
                    <button type="submit" className="w-full">
                      <LogOut className="size-4" aria-hidden="true" />
                      Sign out
                    </button>
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
