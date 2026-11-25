import Link from "next/link"
import { ArrowLeft, ExternalLink, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const NEW_DOMAIN_URL = "https://erpcf.in"

interface NewDomainNoticeProps {
  company: string
  // Off on the lock overlay, where "back" would only lead to the locked page.
  showBackLink?: boolean
}

// Points users to Inward's new home on erpcf.in.
export function NewDomainNotice({ company, showBackLink = true }: NewDomainNoticeProps) {
  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Globe className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Inward has shifted to a new domain</h1>
        </CardTitle>
        <CardDescription>Inward is now available at erpcf.in. Click below to continue there.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3">
        <Button asChild size="lg" className="gap-2">
          <a href={NEW_DOMAIN_URL}>
            Go to erpcf.in
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
        {showBackLink && (
          <Button asChild variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
            <Link href={`/${company}/inward`}>
              <ArrowLeft className="h-4 w-4" />
              Back to Inward Entries
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
