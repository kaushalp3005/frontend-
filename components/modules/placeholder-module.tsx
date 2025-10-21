import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Construction, Calendar, Users, Code } from "lucide-react"

interface PlaceholderModuleProps {
  title: string
  description: string
  features: string[]
  estimatedCompletion?: string
  priority?: "high" | "medium" | "low"
}

export function PlaceholderModule({
  title,
  description,
  features,
  estimatedCompletion,
  priority = "medium",
}: PlaceholderModuleProps) {
  const priorityColors = {
    high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  }

  return (
    <div className="container mx-auto p-6">
      <Card className="max-w-4xl mx-auto">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Construction className="h-16 w-16 text-muted-foreground" />
          </div>
          <CardTitle className="text-3xl">{title}</CardTitle>
          <CardDescription className="text-lg">{description}</CardDescription>
          <div className="flex items-center justify-center gap-2 mt-4">
            <Badge className={priorityColors[priority]}>{priority.toUpperCase()} PRIORITY</Badge>
            {estimatedCompletion && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {estimatedCompletion}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Code className="h-5 w-5" />
              Planned Features
            </h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {features.map((feature, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <div className="h-2 w-2 bg-primary rounded-full" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Development Status
            </h4>
            <p className="text-sm text-muted-foreground">
              This module is currently in the planning phase. The backend infrastructure and business logic are being
              designed to support the features listed above.
            </p>
          </div>

          <div className="flex justify-center">
            <Button variant="outline" disabled>
              Coming Soon
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
