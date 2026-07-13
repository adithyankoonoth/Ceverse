import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-card/30">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-base font-semibold">Ceverse</div>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            The operating system for creator-led brands. A product by Favverse.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 text-sm">
          <div className="space-y-2">
            <div className="font-medium text-foreground">Product</div>
            <Link href="/sign-up" className="block text-muted-foreground hover:text-foreground">
              Start free
            </Link>
            <a href="#product" className="block text-muted-foreground hover:text-foreground">
              Features
            </a>
          </div>
          <div className="space-y-2">
            <div className="font-medium text-foreground">Company</div>
            <span className="block text-muted-foreground">Favverse</span>
            <span className="block text-muted-foreground">Security</span>
          </div>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Favverse. Ceverse is a Favverse product.
      </div>
    </footer>
  );
}
