"use client";

import { Logo } from "@/components/logo";
import { Bell, ClipboardList, ExternalLink, FileCheck, FileSignature, FileText, Home, Layers, LayoutDashboard, LogIn, User, UserCog, Users, Wallet, Wrench } from "lucide-react";
import * as React from "react";
import { Link } from "react-router-dom";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useUser } from "@/contexts/user-context";

// /app is the ERPNext desk - a separate application outside this SPA's
// basename, so it needs a plain <a> (full page load), not a router <Link>.
function DeskLink() {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Advanced</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild tooltip="Open ERPNext Desk" className="cursor-pointer">
            <a href="/app">
              <ExternalLink />
              <span>ERPNext Desk</span>
            </a>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}

const data = {
  navGroups: [],
};

const publicNavGroups = [
  {
    label: "",
    items: [
      {
        title: "Properties",
        url: "/properties",
        icon: Home,
      },
    ],
  },
];

const privateNavGroups = [
  {
    label: "Main",
    items: [
      {
        title: "Dashboard",
        url: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        title: "Properties",
        url: "/properties",
        icon: Home,
      },
    ],
  },
  {
    label: "User Management",
    items: [
      {
        title: "Users",
        url: "/users",
        icon: User,
      },
    ],
  },
];

// Tenants get their dashboard, payments, issues, and their contract -
// no Properties link (that's for browsing/applying, not for an active tenant).
const tenantNavGroups = [
  {
    label: "Main",
    items: [
      {
        title: "Dashboard",
        url: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        title: "Payments",
        url: "/payments",
        icon: Wallet,
      },
      {
        title: "Issues",
        url: "/issues",
        icon: Wrench,
      },
      {
        title: "My Contract",
        url: "/contract",
        icon: FileText,
      },
    ],
  },
];

const staffNavGroups = [
  {
    label: "Main",
    items: [
      {
        title: "Dashboard",
        url: "/dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "Management",
    items: [
      {
        title: "Properties",
        url: "/admin/properties",
        icon: Home,
      },
      {
        title: "Units",
        url: "/admin/units",
        icon: Layers,
      },
      {
        title: "Tenants",
        url: "/admin/tenants",
        icon: Users,
      },
      {
        title: "Notices",
        url: "/admin/notices",
        icon: Bell,
      },
      {
        title: "Applications",
        url: "/admin/applications",
        icon: FileCheck,
      },
      {
        title: "Contracts",
        url: "/admin/contracts",
        icon: FileSignature,
      },
      {
        title: "Manage Issues",
        url: "/admin/issues",
        icon: ClipboardList,
      },
    ],
  },
];

// Landlords add Caretakers from Staff; only a System Manager also gets the
// raw Frappe user list. Caretakers get neither.
function userManagementGroup(roles: string[]) {
  const items = [];
  if (roles.includes("Landlord") || roles.includes("System Manager")) {
    items.push({ title: "Staff", url: "/admin/staff", icon: UserCog });
  }
  if (roles.includes("System Manager")) {
    items.push({ title: "All Users", url: "/users", icon: User });
  }
  return items.length ? [{ label: "User Management", items }] : [];
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, isLoading, error, logout } = useUser();

  if (isLoading) {
    return (
      <Sidebar {...props}>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link to="/dashboard">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Logo size={24} className="text-current" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">Kings Manage</span>
                    <span className="truncate text-xs">Loading...</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <div className="flex items-center justify-center p-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        </SidebarContent>
        <SidebarFooter>
          <div className="p-2 text-center text-sm text-muted-foreground">
            Loading user...
          </div>
        </SidebarFooter>
      </Sidebar>
    );
  }

  if (error) {
    console.error("Error fetching user data:", error);
  }

  const isAuthenticated = !!user;
  const userRoles: string[] = (user?.roles || []).map((r: any) => r.role);
  const isStaff = userRoles.includes("Landlord") || userRoles.includes("Caretaker");
  const isTenant = userRoles.includes("Tenant");
  const navGroupsForUser = isStaff
    ? [...staffNavGroups, ...userManagementGroup(userRoles)]
    : isTenant
      ? tenantNavGroups
      : privateNavGroups;

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to={isAuthenticated ? "/dashboard" : "/auth/sign-in"}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Logo size={24} className="text-current" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Kings Manage</span>
                  <span className="truncate text-xs">
                    {isAuthenticated ? "Admin Dashboard" : "Welcome"}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {data.navGroups.map((group) => (
          <NavMain key={group.label} label={group.label} items={group.items} />
        ))}
        {isAuthenticated ? (
          <>
            {navGroupsForUser.map((group) => (
              <NavMain
                key={group.label}
                label={group.label}
                items={group.items}
              />
            ))}
            {(userRoles.includes("Landlord") || userRoles.includes("System Manager")) && (
              <DeskLink />
            )}
          </>
        ) : (
          <>
            {publicNavGroups.map((group) => (
              <NavMain
                key={group.label}
                label={group.label}
                items={group.items}
              />
            ))}
          </>
        )}
      </SidebarContent>
      <SidebarFooter>
        {isAuthenticated ? (
          <NavUser user={user} onLogout={logout} />
        ) : (
          <div className="p-2">
            <Link
              to="/auth/sign-in"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all hover:bg-accent hover:text-accent-foreground"
            >
              <LogIn className="h-4 w-4" />
              <span>Sign In</span>
            </Link>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
