"use client"

// Block builder for the free-form `details` JSON body — shadcn inputs.

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, X, ChevronUp, ChevronDown } from "lucide-react"
import { emptyBlock, type Block, type BlockType } from "@/lib/packing"

function ValueInput({ block, onChange }: { block: Block; onChange: (v: string) => void }) {
  switch (block.type) {
    case "number":
      return (
        <Input type="number" value={block.value} placeholder="0"
          onChange={(e) => onChange(e.target.value)} className="flex-1 min-w-[160px]" />
      )
    case "boolean":
      return (
        <Select value={block.value || "false"} onValueChange={onChange}>
          <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Yes</SelectItem>
            <SelectItem value="false">No</SelectItem>
          </SelectContent>
        </Select>
      )
    case "date":
      return (
        <Input type="date" value={block.value}
          onChange={(e) => onChange(e.target.value)} className="flex-1 min-w-[160px]" />
      )
    case "list":
      return (
        <Input type="text" value={block.value} placeholder="a, b, c"
          onChange={(e) => onChange(e.target.value)} className="flex-1 min-w-[160px]" />
      )
    case "json":
      return (
        <Textarea value={block.value} placeholder='{ "nested": true }' rows={2}
          onChange={(e) => onChange(e.target.value)} className="flex-1 min-w-[160px] font-mono text-xs" />
      )
    default:
      return (
        <Input type="text" value={block.value} placeholder="value"
          onChange={(e) => onChange(e.target.value)} className="flex-1 min-w-[160px]" />
      )
  }
}

export function BlockEditor({
  blocks,
  onChange,
}: {
  blocks: Block[]
  onChange: (blocks: Block[]) => void
}) {
  const patch = (id: string, p: Partial<Block>) =>
    onChange(blocks.map((b) => (b.id === id ? { ...b, ...p } : b)))
  const remove = (id: string) => onChange(blocks.filter((b) => b.id !== id))
  const add = () => onChange([...blocks, emptyBlock()])
  // Reorder is user-driven and persisted verbatim: the block order here is the
  // order saved to (and read back from) `details`. Nothing re-sorts it.
  const move = (from: number, to: number) => {
    if (to < 0 || to >= blocks.length) return
    const next = [...blocks]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChange(next)
  }

  return (
    <div className="space-y-2">
      {blocks.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No blocks yet — add a block to build the details JSON body.
        </p>
      )}
      {blocks.map((b, i) => (
        <div key={b.id} className="flex flex-wrap items-start gap-2 rounded border p-2">
          <div className="flex flex-col">
            <Button type="button" variant="ghost" size="icon" title="Move up"
              className="h-5 w-6 text-muted-foreground" disabled={i === 0}
              onClick={() => move(i, i - 1)}>
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" title="Move down"
              className="h-5 w-6 text-muted-foreground" disabled={i === blocks.length - 1}
              onClick={() => move(i, i + 1)}>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
          <Input
            value={b.label}
            placeholder="Field name (JSON key)"
            onChange={(e) => patch(b.id, { label: e.target.value })}
            className="flex-1 min-w-[150px]"
          />
          <Select value={b.type} onValueChange={(v) => patch(b.id, { type: v as BlockType, value: "" })}>
            <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="number">Number</SelectItem>
              <SelectItem value="boolean">Yes/No</SelectItem>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="list">List</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
            </SelectContent>
          </Select>
          <ValueInput block={b} onChange={(v) => patch(b.id, { value: v })} />
          <Button type="button" variant="ghost" size="icon" onClick={() => remove(b.id)}
            className="text-rose-600 hover:text-rose-700">
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Add block
      </Button>
    </div>
  )
}
