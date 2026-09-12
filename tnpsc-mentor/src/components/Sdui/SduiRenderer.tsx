// ─── Server-driven UI: the renderer ──────────────────────────────────────────
// Walks a validated tree and draws it. Two jobs beyond the obvious recursion:
//
//   1. Visibility is decided HERE, once, for every node — a component never
//      evaluates its own `when`, so there is a single place to reason about why
//      something did or didn't appear.
//   2. Nothing a layout does may take the screen down with it. The whole tree
//      renders inside an error boundary that swaps in the caller's fallback and
//      reports once. A bad banner costs a banner, never the dashboard.

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { matches } from '../../lib/sdui/conditions'
import { useSduiAction } from '../../lib/sdui/actions'
import type { SduiContext } from '../../lib/sdui/context'
import type { SduiLayout, SduiNode } from '../../lib/sdui/types'
import { reportClientError } from '../../lib/reportClientError'
import { SDUI_REGISTRY, type SduiNodeProps } from './registry'
import type { SduiNodeType } from '../../lib/sdui/validate'

interface RendererProps {
  layout: SduiLayout
  ctx: SduiContext
  /** Drawn instead of the layout if rendering throws. */
  fallback?: ReactNode
}

/** Render one validated layout. */
export default function SduiRenderer({ layout, ctx, fallback = null }: RendererProps) {
  return (
    <SduiBoundary layoutKey={layout.key} fallback={fallback}>
      <SduiNodes nodes={layout.nodes} ctx={ctx} layoutKey={layout.key} />
    </SduiBoundary>
  )
}

function SduiNodes({
  nodes,
  ctx,
  layoutKey,
}: {
  nodes: SduiNode[]
  ctx: SduiContext
  layoutKey: string
}) {
  return (
    <>
      {nodes.map((node, i) => (
        <SduiNodeView key={node.key ?? `${node.type}-${i}`} node={node} ctx={ctx} layoutKey={layoutKey} />
      ))}
    </>
  )
}

function SduiNodeView({
  node,
  ctx,
  layoutKey,
}: {
  node: SduiNode
  ctx: SduiContext
  layoutKey: string
}) {
  const run = useSduiAction(layoutKey)

  // Hooks must run before any early return, so the visibility test comes after
  // useSduiAction — a node whose audience doesn't match still costs one
  // useCallback and nothing else.
  if (!matches(node.when, ctx)) return null

  const Component_ = SDUI_REGISTRY[node.type as SduiNodeType]
  // Validation drops unknown types, so this only fires if the registry and the
  // type list disagree — a build error in practice, handled rather than thrown.
  if (!Component_) return null

  const interactive = Boolean(node.action && node.action.kind !== 'none')

  const props: SduiNodeProps = {
    node,
    ctx,
    interactive,
    onAction: () => run(node.action, node.key),
    children: node.children?.length ? (
      <SduiNodes nodes={node.children} ctx={ctx} layoutKey={layoutKey} />
    ) : null,
  }

  return <Component_ {...props} />
}

// ─── Boundary ────────────────────────────────────────────────────────────────

interface BoundaryProps {
  layoutKey: string
  fallback: ReactNode
  children: ReactNode
}

/**
 * Catches anything thrown while drawing a server-supplied tree. Reported to the
 * same client-error pipe as a crash (so a bad layout surfaces in the Telegram
 * feed within minutes of publishing) but shown to the user as the built-in
 * screen — which is exactly what they'd have seen before the layout existed.
 */
class SduiBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportClientError({
      kind: 'generic',
      path: '/sdui',
      message: `SDUI layout "${this.props.layoutKey}" failed to render: ${error.message}`,
      componentStack: info.componentStack,
    })
  }

  render() {
    if (this.state.failed) return <>{this.props.fallback}</>
    return <>{this.props.children}</>
  }
}
