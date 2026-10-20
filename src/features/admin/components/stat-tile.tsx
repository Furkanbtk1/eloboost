import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

/** Label, headline value and an optional hint; links to the section that explains the number. */
export function StatTile({ label, value, hint, href }: { label: string; value: string; hint?: string; href?: string }) {
  const card = (
    <Card className="h-full transition-colors group-hover:border-primary/50">
      <CardHeader className="gap-1">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold">{value}</CardTitle>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardHeader>
    </Card>
  );
  return href ? (
    <Link href={href} className="group block rounded-xl">
      {card}
    </Link>
  ) : (
    card
  );
}
