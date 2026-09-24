"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useSidebarConfig } from "@/hooks/use-sidebar-config";
import nairobiSkyline from "@/assets/nairobi-skyline.jpg";
import * as React from "react";

// A faint, fixed watermark behind the app shell - cards/tables stay fully
// opaque on top of it, so it never competes with data.
//
// Deliberately no negative z-index: with nothing between this and <body>
// creating a stacking context, a negative index puts it behind <body>'s
// own opaque bg-background, making it invisible. AppSidebar/SidebarInset
// are already `position: relative`, so plain DOM order (this renders
// first) is enough to keep them stacked above it.
function BackgroundImage() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 bg-cover bg-center opacity-[0.12] dark:opacity-[0.18]"
      style={{ backgroundImage: `url(${nairobiSkyline})` }}
    />
  );
}

interface BaseLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function BaseLayout({ children, title, description }: BaseLayoutProps) {
  const [themeCustomizerOpen, setThemeCustomizerOpen] = React.useState(false);
  const { config } = useSidebarConfig();

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "16rem",
          "--sidebar-width-icon": "3rem",
          "--header-height": "calc(var(--spacing) * 14)",
        } as React.CSSProperties
      }
      className={config.collapsible === "none" ? "sidebar-none-mode" : ""}
    >
      <BackgroundImage />
      {config.side === "left" ? (
        <>
          <AppSidebar
            variant={config.variant}
            collapsible={config.collapsible}
            side={config.side}
          />
          <SidebarInset className="bg-transparent">
            <SiteHeader />
            <div className="flex flex-1 flex-col">
              <div className="@container/main flex flex-1 flex-col gap-2">
                <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                  {title && (
                    <div className="px-4 lg:px-6">
                      <div className="flex flex-col gap-2">
                        <h1 className="text-2xl font-bold tracking-tight">
                          {title}
                        </h1>
                        {description && (
                          <p className="text-muted-foreground">{description}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {children}
                </div>
              </div>
            </div>
          </SidebarInset>
        </>
      ) : (
        <>
          <SidebarInset className="bg-transparent">
            <SiteHeader />
            <div className="flex flex-1 flex-col">
              <div className="@container/main flex flex-1 flex-col gap-2">
                <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                  {title && (
                    <div className="px-4 lg:px-6">
                      <div className="flex flex-col gap-2">
                        <h1 className="text-2xl font-bold tracking-tight">
                          {title}
                        </h1>
                        {description && (
                          <p className="text-muted-foreground">{description}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {children}
                </div>
              </div>
            </div>
          </SidebarInset>
          <AppSidebar
            variant={config.variant}
            collapsible={config.collapsible}
            side={config.side}
          />
        </>
      )}
    </SidebarProvider>
  );
}
