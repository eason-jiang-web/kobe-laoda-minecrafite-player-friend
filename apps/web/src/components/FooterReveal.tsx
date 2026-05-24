import { HoverLink } from "@/components/HoverLink";
import { brand, nav, worksWith } from "@/lib/content";

const footerColumns = [
  {
    title: "navigation",
    links: nav.map((item) => ({ label: item.label, href: item.href })),
  },
  {
    title: "contacts",
    links: [
      { label: brand.email, href: `mailto:${brand.email}` },
      { label: "discord voice" },
    ],
  },
  {
    title: "runs on",
    links: worksWith.slice(0, 3).map((label) => ({ label })),
  },
  {
    title: "status",
    links: [
      { label: "early access", href: "#cta" },
      { label: "co-op ai" },
    ],
  },
];

export function FooterReveal() {
  return (
    <footer className="fixed bottom-0 left-0 z-0 hidden h-[720px] w-full bg-canvas px-5 text-ink md:block">
      <div className="relative h-full w-full">
        <p className="u-label absolute left-0 top-5 text-muted">all rights reserved</p>
        <p className="u-label absolute left-1/2 top-5 -translate-x-1/2 text-muted">
          {brand.name}
        </p>
        <p className="u-label absolute right-0 top-5 text-muted">©{brand.year}</p>

        <div className="absolute left-1/2 top-[289px] w-[472px] max-w-[80vw] -translate-x-1/2 text-center">
          <div className="pointer-events-none absolute -left-[52px] -top-[15px] h-2 w-2 border-l border-t border-ink" />
          <div className="pointer-events-none absolute -right-[52px] -top-[15px] h-2 w-2 border-r border-t border-ink" />
          <div className="pointer-events-none absolute -bottom-[11px] -left-[52px] h-2 w-2 border-b border-l border-ink" />
          <div className="pointer-events-none absolute -bottom-[11px] -right-[52px] h-2 w-2 border-b border-r border-ink" />
          <p className="font-sans text-[24px] font-medium uppercase leading-none">
            spawns next to you
            <br />
            follows, helps, talks
            <br />
            remembers the world
          </p>
        </div>

        <div className="absolute bottom-5 left-0 right-0 grid grid-cols-4">
          {footerColumns.map((column) => (
            <div key={column.title}>
              <p className="u-label mb-[24px] text-muted">{column.title}</p>
              <ul>
                {column.links.map((link) => (
                  <li key={link.label} className="u-label text-ink">
                    {link.href ? (
                      <HoverLink href={link.href}>{link.label}</HoverLink>
                    ) : (
                      link.label
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
