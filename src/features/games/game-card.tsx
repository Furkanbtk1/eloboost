import { ArrowRightIcon } from "lucide-react";
import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { GameSummary } from "@/features/games/queries";
import { Link } from "@/i18n/navigation";

export function GameCard({ game }: { game: GameSummary }) {
  const t = useTranslations("Home");
  const tOrderType = useTranslations("OrderType");
  const format = useFormatter();

  return (
    <Link href={`/boost/${game.slug}`} className="group block rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
      <Card className="h-full transition-colors group-hover:border-primary/50">
        <CardHeader className="flex flex-row items-center gap-4">
          {game.logoUrl && (
            <Image
              src={game.logoUrl}
              alt=""
              width={56}
              height={56}
              className="rounded-xl transition-transform group-hover:scale-105"
            />
          )}
          <div className="space-y-1">
            <CardTitle className="text-lg">{game.name}</CardTitle>
            {game.startingPrice !== null && (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {t("startingFrom", {
                    price: format.number(game.startingPrice, { style: "currency", currency: "USD" }),
                  })}
                </span>{" "}
                {game.rankSystem === "RATING" ? t("per100Rating") : t("perDivision")}
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {game.supportedOrderTypes.map((type) => (
            <Badge key={type} variant="secondary">
              {tOrderType(type)}
            </Badge>
          ))}
        </CardContent>
        <CardFooter className="mt-auto text-sm font-medium text-primary">
          {t("boostNow")}
          <ArrowRightIcon className="ml-1 size-4 transition-transform group-hover:translate-x-0.5" />
        </CardFooter>
      </Card>
    </Link>
  );
}
